package cache

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strconv"

	"abr.local/common/db"
	"abr.local/common/duck"

	"abrg/internal/infra/config"
	"abrg/internal/infra/duckdb"
	"abrg/internal/model"
	"abrg/internal/schema"
	"abrg/internal/transform"
	"abrg/internal/util"
)

// When a user inputs just a ward name (e.g., "中区"), multiple cities may contain that ward.
type WardCandidate struct {
	CityWard string // Combined city+ward name (e.g., "横浜市中区")
	PrefCode string // Prefecture code zero-padded (e.g., "14")
}

// DuckDBCache manages a read-only DuckDB instance for caching ABR data.
// It maintains in-memory mappings for address resolution optimization.
type DuckDBCache struct {
	db      *sql.DB // DuckDB connection via database/sql interface
	lookups Lookups // In-memory lookup tables, filled by the build* methods
}

// The cache file must already exist and be valid (created by `abrg cache build`).
// The cache path is resolved from config/environment.
func NewDuckDBCache(ctx context.Context) (*DuckDBCache, error) {
	cfg := config.Load()
	cachePath := duckdb.ResolvePath("", cfg.Cache.Path)
	return newDuckDBCache(ctx, cachePath, cfg.Cache.DuckDBThreads)
}

// The cache file must already exist and be valid (created by `abrg cache build`).
//
// Unlike NewDuckDBCache, this verifies that the cache's normalized addresses
// match what this binary produces. Only serve opens its cache this way: a
// server on a mismatched cache answers with silently degraded match levels,
// while the CLI is left able to run a changed normalization against an
// existing cache.
func NewDuckDBCacheFromPath(ctx context.Context, cachePath string) (*DuckDBCache, error) {
	cache, err := newDuckDBCache(ctx, cachePath, config.Load().Cache.DuckDBThreads)
	if err != nil {
		return nil, err
	}
	if err := verifyNormalization(ctx, cache.db); err != nil {
		_ = cache.Close()
		return nil, err
	}
	return cache, nil
}

func newDuckDBCache(ctx context.Context, cachePath, duckdbThreads string) (*DuckDBCache, error) {
	// Cache file path is required
	if cachePath == "" {
		return nil, fmt.Errorf("cache file required: use 'abrg cache build' to create one")
	}

	// Open DuckDB connection in read-only mode
	conn, err := duckdb.OpenReadOnly(cachePath)
	if err != nil {
		return nil, err
	}

	// Close connection on any initialization error
	success := false
	defer func() {
		if !success {
			if closeErr := conn.Close(); closeErr != nil {
				slog.Warn("failed to close duckdb connection", "error", closeErr)
			}
		}
	}()

	cache := &DuckDBCache{
		db: conn,
	}

	if err := applyThreadLimit(ctx, conn, duckdbThreads); err != nil {
		return nil, err
	}

	// Reject caches built for a different schema before running any query
	// against their tables.
	if err := checkSchemaVersion(ctx, conn); err != nil {
		return nil, err
	}

	// Reject caches whose category tables are missing despite the build
	// configuration claiming them.
	if err := checkCategoryTables(ctx, conn); err != nil {
		return nil, err
	}

	// Load spatial extension (works in read-only mode)
	if err := duck.LoadExtension(ctx, conn, "spatial"); err != nil {
		return nil, fmt.Errorf("failed to initialize spatial extension: %w", err)
	}

	// Build city-prefecture mapping from existing cache
	if err := cache.buildCityPrefectureCodes(ctx); err != nil {
		return nil, fmt.Errorf("failed to build city-prefecture mapping: %w", err)
	}

	// Build city+ward to lg_code mapping for search optimization
	if err := cache.buildCityWardLgCodes(ctx); err != nil {
		return nil, fmt.Errorf("failed to build city-ward lg_code mapping: %w", err)
	}

	// Build ward candidates for ward-only address resolution
	if err := cache.buildWardCandidates(ctx); err != nil {
		return nil, fmt.Errorf("failed to build ward candidates: %w", err)
	}

	// Build city-boundary matcher for longest-prefix city name resolution
	if err := cache.buildCityBoundary(ctx); err != nil {
		return nil, fmt.Errorf("failed to build city boundary matcher: %w", err)
	}

	success = true
	return cache, nil
}

// checkSchemaVersion verifies that the schema version recorded in the cache
// matches the version this binary was built for (cache_schema.yaml). Caches
// without the key predate the check and are rejected as well.
func checkSchemaVersion(ctx context.Context, conn *sql.DB) error {
	required, err := schema.Version()
	if err != nil {
		return fmt.Errorf("failed to load required schema version: %w", err)
	}

	var got string
	err = conn.QueryRowContext(ctx,
		"SELECT config_value FROM cache_config WHERE config_key = ?", KeySchemaVersion).Scan(&got)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("cache has no schema version (built by an older abrg): run 'abrg cache build' to rebuild")
	}
	if err != nil {
		return fmt.Errorf("failed to read cache schema version: %w", err)
	}
	if got != strconv.Itoa(required) {
		return fmt.Errorf("cache schema version %s, binary requires %d: run 'abrg cache build' to rebuild", got, required)
	}
	return nil
}

// requiredCategoryTables returns the tables a cache built with the given
// enabled_category must contain. The basic tables are created for every
// category and are not listed here.
func requiredCategoryTables(category string) []string {
	switch category {
	case string(model.CategoryResidential):
		return []string{duckdb.TableRsdtdsp}
	case string(model.CategoryParcel):
		return []string{duckdb.TableParcel}
	case model.All:
		return []string{duckdb.TableRsdtdsp, duckdb.TableParcel}
	default:
		return nil
	}
}

// checkCategoryTables verifies at open time that every category table claimed
// by enabled_category exists, so a corrupted or incomplete cache fails at
// startup instead of surfacing as SQL errors at query time. Data availability
// itself is derived from enabled_category (Config.HasResidential/HasParcel),
// not from table presence.
func checkCategoryTables(ctx context.Context, conn *sql.DB) error {
	var category string
	err := conn.QueryRowContext(ctx,
		"SELECT config_value FROM cache_config WHERE config_key = ?", db.KeyEnabledCategory).Scan(&category)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("failed to read enabled_category: %w", err)
	}

	for _, table := range requiredCategoryTables(category) {
		exists, err := tableExists(ctx, conn, table)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("cache is corrupted or incomplete: table %s missing while enabled_category=%s: run 'abrg cache build' to rebuild", table, category)
		}
	}
	return nil
}

// tableExists checks whether a table exists using DuckDB's information
// schema. A query failure is returned to the caller so that a transient
// error (e.g. a cancelled context) cannot be mistaken for a permanently
// missing table.
func tableExists(ctx context.Context, conn *sql.DB, tableName string) (bool, error) {
	var exists bool
	err := conn.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = ?)",
		tableName,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check table %s existence: %w", tableName, err)
	}
	return exists, nil
}

// applyThreadLimit caps DuckDB's intra-query parallelism. The workload is
// dominated by small point lookups where per-query fan-out to every core only
// contends with request- and worker-level parallelism. A value of 0 keeps the
// DuckDB default of one thread per core.
func applyThreadLimit(ctx context.Context, conn *sql.DB, v string) error {
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		return fmt.Errorf("invalid ABRG_DUCKDB_THREADS %q: must be a non-negative integer", v)
	}
	if n == 0 {
		return nil
	}
	if _, err := conn.ExecContext(ctx, fmt.Sprintf("SET threads TO %d", n)); err != nil {
		return fmt.Errorf("failed to set duckdb threads: %w", err)
	}
	return nil
}

func (c *DuckDBCache) Close() error {
	return c.db.Close()
}

// DB returns the underlying database connection for use by other packages.
func (c *DuckDBCache) DB() *sql.DB {
	return c.db
}

type Lookups struct {
	CityPrefCodes   map[string]string          // Maps unique city names to prefecture codes (e.g., "京都市" -> "26")
	CityWardLgCodes map[string]string          // Maps city+ward names to lg_code (e.g., "京都市中京区" -> "261041")
	WardCandidates  map[string][]WardCandidate // Maps ward names to all candidate cities (e.g., "中区" -> [{横浜市中区, ...}, ...])
	CityBoundary    *util.CityBoundary         // Longest-prefix city-boundary matcher over all city names
}

// Lookups returns all in-memory lookup maps as a single struct.
func (c *DuckDBCache) Lookups() Lookups {
	return c.lookups
}

// buildCityBoundary loads every city-boundary string (city+ward and
// county+city+ward forms, including names shared across prefectures) so the
// boundary can be resolved by longest-prefix match rather than by heuristic.
func (c *DuckDBCache) buildCityBoundary(ctx context.Context) error {
	query := `
		SELECT DISTINCT s FROM (
			SELECT city || COALESCE(ward, '') AS s FROM cache_city
			UNION ALL
			SELECT COALESCE(county, '') || city || COALESCE(ward, '') FROM cache_city
		) WHERE s IS NOT NULL AND s != ''
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query city boundary strings: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var cityStrings []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			return fmt.Errorf("failed to scan city boundary row: %w", err)
		}
		// Find is given normalized text, so the dictionary holds the
		// normalized form. TextForDB is what normalized_address is built
		// with, which keeps the two sides in step.
		normalized, _ := transform.TextForDB(s)
		cityStrings = append(cityStrings, normalized)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	c.lookups.CityBoundary = util.NewCityBoundary(cityStrings)
	return nil
}

func (c *DuckDBCache) buildCityPrefectureCodes(ctx context.Context) error {
	// Query to get cities that exist in only one prefecture
	query := `
		SELECT city, MIN(printf('%02d', pref_code)) as pref_code
		FROM cache_city
		GROUP BY city
		HAVING COUNT(DISTINCT pref_code) = 1
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query city-prefecture mapping: %w", err)
	}
	defer func() { _ = rows.Close() }()

	codes := make(map[string]string)
	for rows.Next() {
		var city, prefCode string
		if err := rows.Scan(&city, &prefCode); err != nil {
			return fmt.Errorf("failed to scan city-prefecture row: %w", err)
		}
		codes[city] = prefCode
	}
	if err := rows.Err(); err != nil {
		return err
	}

	c.lookups.CityPrefCodes = normalizeKeys(codes)
	return nil
}

// normalizeKeys re-keys a lookup by the normalized form of its keys, because
// callers search it with normalized text. Names that are distinct raw but share
// a normalized form (鹿嶋市 and 鹿島市 both become 鹿島市) are dropped when they
// disagree, so the address is scoped by the rest of it — its town, or the
// prefecture it names — instead of by a coin flip between two municipalities.
// Nationwide that is one key.
func normalizeKeys(raw map[string]string) map[string]string {
	out := make(map[string]string, len(raw))
	ambiguous := make(map[string]bool)
	for k, v := range raw {
		nk, _ := transform.TextForDB(k)
		if prev, ok := out[nk]; ok && prev != v {
			ambiguous[nk] = true
		}
		out[nk] = v
	}
	for k := range ambiguous {
		delete(out, k)
	}
	return out
}

// This enables faster Levenshtein search by filtering to specific lg_code.
// The key format is the normalized "city+ward" (e.g. "京都市中京区",
// "名古屋市1000種区") to match what CityBoundary.Find returns.
// For towns with counties, both "county+city" and "city" keys are added.
// Note: city_ward names that exist in multiple prefectures (e.g., "池田町") are excluded
// because they map to multiple lg_codes and cannot be uniquely resolved.
func (c *DuckDBCache) buildCityWardLgCodes(ctx context.Context) error {
	// Get city+ward combinations that map to exactly one lg_code.
	// Inner query: distinct (city_ward, county_city_ward, lg_code) tuples
	// Outer query: keep only city_ward with exactly one lg_code
	query := `
		SELECT city_ward, ANY_VALUE(county_city_ward) as county_city_ward, ANY_VALUE(lg_code) as lg_code
		FROM (
			SELECT
				city || COALESCE(ward, '') as city_ward,
				COALESCE(county, '') || city || COALESCE(ward, '') as county_city_ward,
				lg_code
			FROM cache_city
			GROUP BY city_ward, county_city_ward, lg_code
		)
		GROUP BY city_ward
		HAVING COUNT(*) = 1
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query city-ward lg_code mapping: %w", err)
	}
	defer func() { _ = rows.Close() }()

	codes := make(map[string]string)
	for rows.Next() {
		var cityWard, countyCityWard, lgCode string
		if err := rows.Scan(&cityWard, &countyCityWard, &lgCode); err != nil {
			return fmt.Errorf("failed to scan city-ward lg_code row: %w", err)
		}
		codes[cityWard] = lgCode
		// Also add county+city key for towns (e.g., "遠田郡涌谷町")
		if countyCityWard != cityWard {
			codes[countyCityWard] = lgCode
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	c.lookups.CityWardLgCodes = normalizeKeys(codes)
	return nil
}

// This enables ward-only address resolution (e.g., "中区本町" → try "横浜市中区本町", "名古屋市中区本町", etc.)
// Candidates are ordered by prefecture code and then by city name, because
// equally strong matches are returned in candidate order (e.g. 大阪市北区 and
// 堺市北区 both answer "北区").
// The key is the normalized ward name so that 保土ヶ谷区 finds the ward
// registered as 保土ケ谷区. The city names it maps to stay raw: the caller
// prepends one to the address and transforms the result itself.
func (c *DuckDBCache) buildWardCandidates(ctx context.Context) error {
	query := `
		SELECT ward, city || ward AS city_ward, printf('%02d', pref_code) AS pref_code
		FROM cache_city
		WHERE ward IS NOT NULL AND ward != ''
		GROUP BY ward, city_ward, pref_code
		ORDER BY ward, pref_code, city_ward
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query ward candidates: %w", err)
	}
	defer func() { _ = rows.Close() }()

	c.lookups.WardCandidates = make(map[string][]WardCandidate)
	for rows.Next() {
		var ward, cityWard, prefCode string
		if err := rows.Scan(&ward, &cityWard, &prefCode); err != nil {
			return fmt.Errorf("failed to scan ward candidate row: %w", err)
		}
		key, _ := transform.TextForDB(ward)
		c.lookups.WardCandidates[key] = append(c.lookups.WardCandidates[key], WardCandidate{
			CityWard: cityWard,
			PrefCode: prefCode,
		})
	}

	return rows.Err()
}

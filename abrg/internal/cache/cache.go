package cache

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"strconv"

	"github.com/digital-go-jp/abr-geocoder/common/db"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/infra/config"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/infra/duckdb"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/schema"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/transform"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/util"
)

// WardCandidate is a city+ward that a ward name alone may refer to, e.g. 横浜市中区 for "中区".
type WardCandidate struct {
	CityWard string // Combined city+ward name (e.g., "横浜市中区")
	PrefCode string // Prefecture code zero-padded (e.g., "14")
}

// DuckDBCache is a read-only ABR data cache in DuckDB with in-memory lookups built at open.
type DuckDBCache struct {
	db      *sql.DB // DuckDB connection via database/sql interface
	lookups Lookups // In-memory lookup tables, filled by the build* methods
}

// NewDuckDBCache opens the cache built by `abrg cache build`. flagPath is the
// --cache value and wins over the configured path when it is not empty.
func NewDuckDBCache(ctx context.Context, flagPath string) (*DuckDBCache, error) {
	cfg := config.Load()
	cachePath := duckdb.ResolvePath(flagPath, cfg.Cache.Path)
	return newDuckDBCache(ctx, cachePath, cfg.Cache.DuckDBThreads)
}

// NewDuckDBCacheFromPath opens the cache at cachePath and, unlike NewDuckDBCache,
// rejects it if its normalized addresses differ from what this binary produces.
// Only serve opens its cache this way: a server on a mismatched cache silently
// returns lower match levels, while the CLI can still run a changed
// normalization against an existing cache.
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
	if cachePath == "" {
		return nil, fmt.Errorf("cache file required: use 'abrg cache build' to create one")
	}

	conn, err := duckdb.OpenReadOnly(cachePath)
	if err != nil {
		return nil, err
	}

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

	// Check the schema version before any query touches the cache tables.
	if err := checkSchemaVersion(ctx, conn); err != nil {
		return nil, err
	}

	if err := checkCategoryTables(ctx, conn); err != nil {
		return nil, err
	}

	if err := cache.buildCityPrefectureCodes(ctx); err != nil {
		return nil, fmt.Errorf("failed to build city-prefecture mapping: %w", err)
	}

	if err := cache.buildCityWardLgCodes(ctx); err != nil {
		return nil, fmt.Errorf("failed to build city-ward lg_code mapping: %w", err)
	}

	if err := cache.buildWardCandidates(ctx); err != nil {
		return nil, fmt.Errorf("failed to build ward candidates: %w", err)
	}

	if err := cache.buildCityBoundary(ctx); err != nil {
		return nil, fmt.Errorf("failed to build city boundary matcher: %w", err)
	}

	success = true
	return cache, nil
}

// checkSchemaVersion rejects a cache whose recorded schema version is missing
// or differs from cache_schema.yaml.
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

// requiredCategoryTables returns the category tables a cache with the given
// enabled_category must contain. Basic tables are not listed.
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

// checkCategoryTables fails at open when a table enabled_category requires is
// missing, so an incomplete cache does not surface as SQL errors at query time.
// Which data is available is decided by enabled_category, not by table presence.
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

// tableExists returns query errors rather than false, so a cancelled context
// is not mistaken for a missing table.
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

// applyThreadLimit caps DuckDB's threads per query; 0 keeps DuckDB's default of
// one per core. Queries are mostly small point lookups, where using every core
// only competes with request- and worker-level parallelism.
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

// DB returns the underlying database connection.
func (c *DuckDBCache) DB() *sql.DB {
	return c.db
}

type Lookups struct {
	CityPrefCodes   map[string]string          // Maps unique city names to prefecture codes (e.g., "京都市" -> "26")
	CityWardLgCodes map[string]string          // Maps city+ward names to lg_code (e.g., "京都市中京区" -> "261041")
	WardCandidates  map[string][]WardCandidate // Maps ward names to all candidate cities (e.g., "中区" -> [{横浜市中区, ...}, ...])
	CityBoundary    *util.CityBoundary         // Longest-prefix city-boundary matcher over all city names
}

// Lookups returns the in-memory lookups.
func (c *DuckDBCache) Lookups() Lookups {
	return c.lookups
}

// buildCityBoundary loads every city+ward and county+city+ward name, including
// names shared across prefectures, for longest-prefix matching.
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
		// Find is given normalized text. TextForDB is the same normalization
		// that builds normalized_address.
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

// normalizeKeys re-keys a lookup by normalized keys, since callers search with
// normalized text. Keys that normalize alike but map to different values
// (鹿嶋市 and 鹿島市 both become 鹿島市) are dropped, leaving the address to be
// resolved by its town or prefecture rather than by an arbitrary pick.
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

// buildCityWardLgCodes maps normalized city+ward names, keyed as
// CityBoundary.Find returns them (e.g. "名古屋市1000種区"), to lg_code so the
// Levenshtein search can be narrowed to one municipality. Towns in a county
// get both "county+city" and "city" keys. Names with more than one lg_code
// (e.g. "池田町") are left out.
func (c *DuckDBCache) buildCityWardLgCodes(ctx context.Context) error {
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

// buildWardCandidates maps ward names to the cities that have them, for
// addresses that start at the ward (e.g. "中区本町" tries "横浜市中区本町",
// "名古屋市中区本町", ...). Candidates are ordered by prefecture code, then city,
// because equally strong matches are returned in candidate order. The key is
// normalized so 保土ヶ谷区 finds 保土ケ谷区; the city names stay raw because
// the caller prepends one to the address and transforms the result itself.
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

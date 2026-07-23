package cache

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strconv"

	"abr.local/common/duck"

	"abrg/internal/infra/config"
	"abrg/internal/infra/duckdb"
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
	db                  *sql.DB                    // DuckDB connection via database/sql interface
	cityPrefectureCodes map[string]string          // Maps unique city names to prefecture codes (e.g., "京都市" -> "26")
	cityWardLgCodes     map[string]string          // Maps city+ward names to lg_code (e.g., "京都市中京区" -> "261041")
	wardCandidates      map[string][]WardCandidate // Maps ward names to all candidate cities (e.g., "中区" -> [{横浜市中区, ...}, ...])
	cityBoundary        *util.CityBoundary         // Longest-prefix city-boundary matcher over all city names
}

// The cache file must already exist and be valid (created by `abrg cache build`).
// The cache path is resolved from config/environment.
func NewDuckDBCache(ctx context.Context) (*DuckDBCache, error) {
	cfg := config.Load()
	cachePath := duckdb.ResolvePath("", cfg.Cache.Path)
	return NewDuckDBCacheFromPath(ctx, cachePath)
}

// The cache file must already exist and be valid (created by `abrg cache build`).
func NewDuckDBCacheFromPath(ctx context.Context, cachePath string) (*DuckDBCache, error) {
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

	if err := applyThreadLimit(ctx, conn); err != nil {
		return nil, err
	}

	// Load spatial extension (works in read-only mode)
	if err := duck.LoadExtension(ctx, conn, "spatial"); err != nil {
		return nil, fmt.Errorf("failed to initialize spatial extension: %w", err)
	}

	// Register Go UDFs (in-memory only, doesn't require write access)
	if err := cache.registerUDFs(ctx); err != nil {
		return nil, fmt.Errorf("failed to register UDFs: %w", err)
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

// applyThreadLimit caps DuckDB's intra-query parallelism. The workload is
// dominated by small point lookups where per-query fan-out to every core only
// contends with request- and worker-level parallelism. A value of 0 keeps the
// DuckDB default of one thread per core.
func applyThreadLimit(ctx context.Context, conn *sql.DB) error {
	v := config.Load().Cache.DuckDBThreads
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
	CityPrefCodes   map[string]string          // Maps unique city names to prefecture codes
	CityWardLgCodes map[string]string          // Maps city+ward names to lg_code
	WardCandidates  map[string][]WardCandidate // Maps ward names to candidate cities
	CityBoundary    *util.CityBoundary         // Longest-prefix city-boundary matcher
}

// Lookups returns all in-memory lookup maps as a single struct.
func (c *DuckDBCache) Lookups() Lookups {
	return Lookups{
		CityPrefCodes:   c.cityPrefectureCodes,
		CityWardLgCodes: c.cityWardLgCodes,
		WardCandidates:  c.wardCandidates,
		CityBoundary:    c.cityBoundary,
	}
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
		cityStrings = append(cityStrings, s)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	c.cityBoundary = util.NewCityBoundary(cityStrings)
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

	c.cityPrefectureCodes = make(map[string]string)
	for rows.Next() {
		var city, prefCode string
		if err := rows.Scan(&city, &prefCode); err != nil {
			return fmt.Errorf("failed to scan city-prefecture row: %w", err)
		}
		c.cityPrefectureCodes[city] = prefCode
	}

	return rows.Err()
}

// This enables faster Levenshtein search by filtering to specific lg_code.
// The key format is "city+ward" (e.g., "京都市中京区") to match FindCityBoundary output.
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

	c.cityWardLgCodes = make(map[string]string)
	for rows.Next() {
		var cityWard, countyCityWard, lgCode string
		if err := rows.Scan(&cityWard, &countyCityWard, &lgCode); err != nil {
			return fmt.Errorf("failed to scan city-ward lg_code row: %w", err)
		}
		c.cityWardLgCodes[cityWard] = lgCode
		// Also add county+city key for towns (e.g., "遠田郡涌谷町")
		if countyCityWard != cityWard {
			c.cityWardLgCodes[countyCityWard] = lgCode
		}
	}

	return rows.Err()
}

// This enables ward-only address resolution (e.g., "中区本町" → try "横浜市中区本町", "名古屋市中区本町", etc.)
func (c *DuckDBCache) buildWardCandidates(ctx context.Context) error {
	query := `
		SELECT ward, city || ward AS city_ward, printf('%02d', pref_code) AS pref_code
		FROM cache_city
		WHERE ward IS NOT NULL AND ward != ''
		GROUP BY ward, city_ward, pref_code
		ORDER BY ward, pref_code
	`

	rows, err := c.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to query ward candidates: %w", err)
	}
	defer func() { _ = rows.Close() }()

	c.wardCandidates = make(map[string][]WardCandidate)
	for rows.Next() {
		var ward, cityWard, prefCode string
		if err := rows.Scan(&ward, &cityWard, &prefCode); err != nil {
			return fmt.Errorf("failed to scan ward candidate row: %w", err)
		}
		c.wardCandidates[ward] = append(c.wardCandidates[ward], WardCandidate{
			CityWard: cityWard,
			PrefCode: prefCode,
		})
	}

	return rows.Err()
}

func (c *DuckDBCache) registerUDFs(ctx context.Context) error {
	return registerUDF(ctx, c.db)
}

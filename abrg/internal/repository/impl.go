package repository

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/matchlevel"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

type DB struct {
	db *sql.DB
}

// coordColumns selects lon and lat as DOUBLE. Scanning a FLOAT into a float64
// goes through its shortest decimal form, which drops digits of the stored value.
const coordColumns = "lon::DOUBLE AS lon, lat::DOUBLE AS lat"

func NewRepository(db *sql.DB) *DB {
	return &DB{db: db}
}

// queryRows scans every row of query with scanFn; limit only sizes the slice.
func queryRows[T any](ctx context.Context, db *sql.DB, query string, args []any, limit int, scanFn func(*sql.Rows) (T, error)) ([]T, error) {
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	results := make([]T, 0, limit)
	for rows.Next() {
		r, err := scanFn(rows)
		if err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}

// queryOne scans one row with scanFn, returning nil without error if none matches.
func queryOne[T any](ctx context.Context, db *sql.DB, query string, args []any, scanFn func(*sql.Row) (T, error)) (*T, error) {
	row := db.QueryRowContext(ctx, query, args...)
	result, err := scanFn(row)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &result, nil
}

// Coordinates returns the first coordinates found at the machiaza, city, then
// prefecture level, with that level.
func (r *DB) Coordinates(ctx context.Context, lgCode, machiazaID string) ([]float64, model.MatchLevel) {
	if machiazaID != "" {
		if coords, ok := r.queryCoordinates(ctx, "cache_machiaza", "lg_code = ? AND machiaza_id = ?", lgCode, machiazaID); ok {
			return coords, matchlevel.DetermineMatchLevel(&model.IDs{
				LgCode:     &lgCode,
				MachiazaID: &machiazaID,
			})
		}
	}

	if coords, ok := r.queryCoordinates(ctx, "cache_city", "lg_code = ?", lgCode); ok {
		return coords, model.MatchLevelCity
	}

	if len(lgCode) >= model.LgCodePrefLength {
		prefCode := lgCode[:model.LgCodePrefLength]
		if coords, ok := r.queryCoordinates(ctx, "cache_pref", "pref_code = ?", prefCode); ok {
			return coords, model.MatchLevelPrefecture
		}
	}

	return nil, ""
}

// queryCoordinates returns the coordinates of the first row of table matching
// cond whose lon and lat are both set.
func (r *DB) queryCoordinates(ctx context.Context, table, cond string, args ...any) ([]float64, bool) {
	query := `SELECT ` + coordColumns + ` FROM ` + table + `
		WHERE ` + cond + ` AND lon IS NOT NULL AND lat IS NOT NULL
		LIMIT 1`
	return scanCoordinates(r.db.QueryRowContext(ctx, query, args...))
}

// scanCoordinates returns [lon, lat] from row, or false if there is no row or
// either value is NULL.
func scanCoordinates(row *sql.Row) ([]float64, bool) {
	var lon, lat sql.Null[float64]
	if err := row.Scan(&lon, &lat); err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			slog.Warn("failed to scan coordinates", "error", err)
		}
		return nil, false
	}
	if !lon.Valid || !lat.Valid {
		return nil, false
	}
	return []float64{lon.V, lat.V}, true
}

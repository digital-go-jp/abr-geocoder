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
		coords, level := r.queryBasicCoordinates(ctx, lgCode, machiazaID)
		if coords != nil {
			return coords, level
		}
	}

	if coords, level := r.queryCityCoordinates(ctx, lgCode); coords != nil {
		return coords, level
	}

	if coords, level := r.queryPrefectureByLgCode(ctx, lgCode); coords != nil {
		return coords, level
	}

	if len(lgCode) >= model.LgCodePrefLength {
		prefCode := lgCode[:model.LgCodePrefLength]
		if coords, level := r.queryPrefectureCoordinates(ctx, prefCode); coords != nil {
			return coords, level
		}
	}

	return nil, ""
}

func (r *DB) queryBasicCoordinates(ctx context.Context, lgCode, machiazaID string) ([]float64, model.MatchLevel) {
	query := `
		SELECT ` + coordColumns + `
		FROM cache_machiaza
		WHERE lg_code = ?
		AND machiaza_id = ?
		AND lon IS NOT NULL AND lat IS NOT NULL
		LIMIT 1
	`

	if coords, ok := scanCoordinates(r.db.QueryRowContext(ctx, query, lgCode, machiazaID)); ok {
		level := matchlevel.DetermineMatchLevel(&model.IDs{
			LgCode:     &lgCode,
			MachiazaID: &machiazaID,
		})
		return coords, level
	}
	return nil, ""
}

func (r *DB) queryCityCoordinates(ctx context.Context, lgCode string) ([]float64, model.MatchLevel) {
	query := `
		SELECT ` + coordColumns + `
		FROM cache_city
		WHERE lg_code = ? AND lon IS NOT NULL AND lat IS NOT NULL
		LIMIT 1
	`
	if coords, ok := scanCoordinates(r.db.QueryRowContext(ctx, query, lgCode)); ok {
		return coords, model.MatchLevelCity
	}
	return nil, ""
}

func (r *DB) queryPrefectureByLgCode(ctx context.Context, lgCode string) ([]float64, model.MatchLevel) {
	query := `
		SELECT ` + coordColumns + `
		FROM cache_pref
		WHERE lg_code = ? AND lon IS NOT NULL AND lat IS NOT NULL
		LIMIT 1
	`
	if coords, ok := scanCoordinates(r.db.QueryRowContext(ctx, query, lgCode)); ok {
		return coords, model.MatchLevelPrefecture
	}
	return nil, ""
}

func (r *DB) queryPrefectureCoordinates(ctx context.Context, prefCode string) ([]float64, model.MatchLevel) {
	query := `
		SELECT ` + coordColumns + `
		FROM cache_pref
		WHERE pref_code = ? AND lon IS NOT NULL AND lat IS NOT NULL
		LIMIT 1
	`
	if coords, ok := scanCoordinates(r.db.QueryRowContext(ctx, query, prefCode)); ok {
		return coords, model.MatchLevelPrefecture
	}
	return nil, ""
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

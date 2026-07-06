package repository

import (
	"context"
	"database/sql"
	"fmt"

	"abrg/internal/model"
)

// FindCityByAddress searches cache_city by normalized_address or lg_code.
func (r *DB) FindCityByAddress(ctx context.Context, p CitySearchParams) (*CityResult, error) {
	var query string
	var args []any

	if p.LgCode != "" {
		query = `SELECT lg_code, pref, county, city, ward,
			ST_X(geom) AS lon, ST_Y(geom) AS lat
			FROM cache_city WHERE lg_code = ? LIMIT 1`
		args = []any{p.LgCode}
	} else {
		query = `SELECT lg_code, pref, county, city, ward,
			ST_X(geom) AS lon, ST_Y(geom) AS lat
			FROM cache_city WHERE normalized_address = ?`
		args = []any{p.CityAddr}
		if p.PrefCode != "" && p.PrefCode != model.All {
			query += " AND pref_code = ?"
			args = append(args, p.PrefCode)
		}
		query += " LIMIT 1"
	}

	result, err := queryOne(ctx, r.db, query, args, scanCityWithAddr)
	if err != nil {
		return nil, fmt.Errorf("find city by address lgCode=%q cityAddr=%q: %w", p.LgCode, p.CityAddr, err)
	}
	return result, nil
}

// FindCityRecord searches cache_city using starts_with prefix matching.
func (r *DB) FindCityRecord(ctx context.Context, p CityRecordParams) (*CityResult, error) {
	query := `SELECT lg_code, pref, county, city, ward
		FROM cache_city WHERE starts_with(?, normalized_address)`
	args := []any{p.CityPart}

	if p.PrefCode != "" && p.PrefCode != model.All {
		query += " AND pref_code = ?"
		args = append(args, p.PrefCode)
	}
	query += " ORDER BY length(normalized_address) DESC LIMIT 1"

	result, err := queryOne(ctx, r.db, query, args, scanCityBasic)
	if err != nil {
		return nil, fmt.Errorf("find city record %q: %w", p.CityPart, err)
	}
	return result, nil
}

// FindCityRecordFuzzy searches cache_city using editdist3 fuzzy matching.
func (r *DB) FindCityRecordFuzzy(ctx context.Context, p CityFuzzyParams) (*CityResult, error) {
	if p.PrefCode == "" || p.PrefCode == model.All {
		return nil, nil
	}

	query := `SELECT lg_code, pref, county, city, ward
		FROM (
			SELECT lg_code, pref, county, city, ward,
				editdist3(?, normalized_address) AS dist
			FROM cache_city WHERE pref_code = ?
		) t WHERE dist <= ? ORDER BY dist ASC LIMIT 1`

	args := []any{p.CityPart, p.PrefCode, p.MaxEditDistance}
	result, err := queryOne(ctx, r.db, query, args, scanCityBasic)
	if err != nil {
		return nil, fmt.Errorf("find city record fuzzy %q: %w", p.CityPart, err)
	}
	return result, nil
}

// FindPrefecture searches cache_pref by pref_code.
func (r *DB) FindPrefecture(ctx context.Context, prefCode string) (*PrefectureResult, error) {
	query := `SELECT lg_code, pref FROM cache_pref WHERE pref_code = ? LIMIT 1`

	result, err := queryOne(ctx, r.db, query, []any{prefCode}, func(row *sql.Row) (PrefectureResult, error) {
		var pr PrefectureResult
		err := row.Scan(&pr.LgCode, &pr.PrefName)
		return pr, err
	})
	if err != nil {
		return nil, fmt.Errorf("find prefecture %q: %w", prefCode, err)
	}
	return result, nil
}

// scanCityWithAddr scans a cache_city row with coordinates into CityResult.
func scanCityWithAddr(row *sql.Row) (CityResult, error) {
	var (
		lgCode, prefName   sql.NullString
		county, city, ward sql.NullString
		lon, lat           sql.NullFloat64
	)
	if err := row.Scan(
		&lgCode, &prefName, &county, &city, &ward,
		&lon, &lat,
	); err != nil {
		return CityResult{}, err
	}
	return CityResult{
		LgCode: scanStr(lgCode),
		Pref:   scanStr(prefName),
		County: scanOpt(county),
		City:   scanStr(city),
		Ward:   scanOpt(ward),
		Lon:    scanOptFloat(lon),
		Lat:    scanOptFloat(lat),
	}, nil
}

// scanCityBasic scans a cache_city row without coordinates into CityResult.
func scanCityBasic(row *sql.Row) (CityResult, error) {
	var (
		lgCode, prefName   sql.NullString
		county, city, ward sql.NullString
	)
	if err := row.Scan(
		&lgCode, &prefName, &county, &city, &ward,
	); err != nil {
		return CityResult{}, err
	}
	return CityResult{
		LgCode: scanStr(lgCode),
		Pref:   scanStr(prefName),
		County: scanOpt(county),
		City:   scanStr(city),
		Ward:   scanOpt(ward),
	}, nil
}

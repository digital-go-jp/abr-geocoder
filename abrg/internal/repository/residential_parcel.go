package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Residential best-match queries, one per shape a ResidentialFilter can take.
// The match clauses run from most specific to least specific; each appears
// twice, once as a CASE arm carrying its match level and once in the WHERE
// filter, so every placeholder value is bound on both sides of the three key
// columns. The shared clauses are single-sourced below; Go folds the
// concatenations into plain string constants at compile time.
const (
	residentialBestMatchSelect = `
		SELECT lg_code, machiaza_id, blk_id, rsdt_id, rsdt2_id,
			blk_num, rsdt_num, rsdt_num2,
			ST_X(geom) AS lon, ST_Y(geom) AS lat,
			CASE`
	residentialBestMatchFrom = ` ELSE 0 END AS match_level
		FROM cache_rsdtdsp
		WHERE lg_code = ? AND machiaza_id = ? AND blk_num = ?
			AND `
	residentialBestMatchOrder = `
		ORDER BY match_level DESC LIMIT 1`

	// Both rsdt_num and rsdt_num2 given: rsdt2, rsdt, then blk.
	residentialBestMatchRsdt2Query = residentialBestMatchSelect +
		` WHEN rsdt_num = ? AND rsdt_num2 = ? THEN 3 WHEN rsdt_num = ? AND rsdt_num2 IS NULL THEN 2 WHEN rsdt_num IS NULL AND rsdt_num2 IS NULL THEN 1` +
		residentialBestMatchFrom +
		`((rsdt_num = ? AND rsdt_num2 = ?) OR (rsdt_num = ? AND rsdt_num2 IS NULL) OR (rsdt_num IS NULL AND rsdt_num2 IS NULL))` +
		residentialBestMatchOrder

	// Only rsdt_num given: rsdt, then blk.
	residentialBestMatchRsdtQuery = residentialBestMatchSelect +
		` WHEN rsdt_num = ? AND rsdt_num2 IS NULL THEN 2 WHEN rsdt_num IS NULL AND rsdt_num2 IS NULL THEN 1` +
		residentialBestMatchFrom +
		`((rsdt_num = ? AND rsdt_num2 IS NULL) OR (rsdt_num IS NULL AND rsdt_num2 IS NULL))` +
		residentialBestMatchOrder

	// No rsdt_num: blk only.
	residentialBestMatchBlkQuery = residentialBestMatchSelect +
		` WHEN rsdt_num IS NULL AND rsdt_num2 IS NULL THEN 1` +
		residentialBestMatchFrom +
		`(rsdt_num IS NULL AND rsdt_num2 IS NULL)` +
		residentialBestMatchOrder
)

// FindResidentialBestMatch finds the best residential match in a single query,
// trying rsdt_num2, rsdt_num, then blk_num fallback, returning match level.
func (r *DB) FindResidentialBestMatch(ctx context.Context, lgCode, machiazaID string, filter ResidentialFilter) (*ResidentialBestResult, error) {
	var query string
	var args []any
	switch {
	case filter.RsdtNum != "" && filter.RsdtNum2 != "":
		query = residentialBestMatchRsdt2Query
		args = []any{
			filter.RsdtNum, filter.RsdtNum2, filter.RsdtNum,
			lgCode, machiazaID, filter.BlkNum,
			filter.RsdtNum, filter.RsdtNum2, filter.RsdtNum,
		}
	case filter.RsdtNum != "":
		query = residentialBestMatchRsdtQuery
		args = []any{filter.RsdtNum, lgCode, machiazaID, filter.BlkNum, filter.RsdtNum}
	default:
		query = residentialBestMatchBlkQuery
		args = []any{lgCode, machiazaID, filter.BlkNum}
	}

	return r.scanResidentialBestMatch(ctx, query, args)
}

// scanResidentialBestMatch executes a query that includes a match_level column
// and scans the result into a ResidentialBestResult.
func (r *DB) scanResidentialBestMatch(ctx context.Context, query string, args []any) (*ResidentialBestResult, error) {
	var (
		lgCode, machiazaID     sql.Null[string]
		blkID, rsdtID, rsdt2ID sql.Null[string]
		blkNum, rsdtNum        sql.Null[string]
		rsdtNum2               sql.Null[string]
		lon, lat               sql.Null[float64]
		matchLevel             int
	)
	err := r.db.QueryRowContext(ctx, query, args...).Scan(
		&lgCode, &machiazaID,
		&blkID, &rsdtID, &rsdt2ID,
		&blkNum, &rsdtNum, &rsdtNum2,
		&lon, &lat,
		&matchLevel,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("scan residential best match: %w", err)
	}
	return &ResidentialBestResult{
		ResidentialResult: ResidentialResult{
			LgCode:     scanOpt(lgCode),
			MachiazaID: scanOpt(machiazaID),
			BlkID:      scanOpt(blkID),
			RsdtID:     scanOpt(rsdtID),
			Rsdt2ID:    scanOpt(rsdt2ID),
			BlkNum:     scanOpt(blkNum),
			RsdtNum:    scanOpt(rsdtNum),
			RsdtNum2:   scanOpt(rsdtNum2),
			Lon:        scanOpt(lon),
			Lat:        scanOpt(lat),
		},
		MatchLevel: ResidentialMatchLevel(matchLevel),
	}, nil
}

// FindParcelExact searches cache_parcel for parcel address records with exact matching.
func (r *DB) FindParcelExact(ctx context.Context, lgCode, machiazaID string, filter ParcelFilter) (*ParcelResult, error) {
	query := `
		SELECT
			lg_code,
			machiaza_id,
			prc_id,
			prc_num1,
			prc_num2,
			prc_num3,
			ST_X(geom) AS lon,
			ST_Y(geom) AS lat
		FROM cache_parcel
		WHERE lg_code = ?
		AND machiaza_id = ?
		AND prc_num1 = ?
	`
	args := []any{lgCode, machiazaID, filter.PrcNum1}

	if filter.PrcNum2 != "" {
		query += " AND prc_num2 = ?"
		args = append(args, filter.PrcNum2)
	} else {
		query += " AND prc_num2 IS NULL"
	}

	if filter.PrcNum3 != "" {
		query += " AND prc_num3 = ?"
		args = append(args, filter.PrcNum3)
	} else {
		query += " AND prc_num3 IS NULL"
	}

	query += " LIMIT 1"

	result, err := queryOne(ctx, r.db, query, args, scanParcelRow)
	if err != nil {
		return nil, fmt.Errorf("find parcel exact lgCode=%q machiazaID=%q prc=%q: %w", lgCode, machiazaID, filter.PrcNum1, err)
	}
	return result, nil
}

// scanParcelRow scans a cache_parcel row into ParcelResult.
func scanParcelRow(row *sql.Row) (ParcelResult, error) {
	var (
		lgCode, machiazaID sql.Null[string]
		prcID, prcNum1     sql.Null[string]
		prcNum2, prcNum3   sql.Null[string]
		lon, lat           sql.Null[float64]
	)
	if err := row.Scan(
		&lgCode, &machiazaID,
		&prcID, &prcNum1, &prcNum2, &prcNum3,
		&lon, &lat,
	); err != nil {
		return ParcelResult{}, err
	}
	return ParcelResult{
		LgCode:     scanOpt(lgCode),
		MachiazaID: scanOpt(machiazaID),
		PrcID:      scanOpt(prcID),
		PrcNum1:    scanOpt(prcNum1),
		PrcNum2:    scanOpt(prcNum2),
		PrcNum3:    scanOpt(prcNum3),
		Lon:        scanOpt(lon),
		Lat:        scanOpt(lat),
	}, nil
}

package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

// FindResidentialBestMatch finds the best residential match in a single query,
// trying rsdt_num2, rsdt_num, then blk_num fallback, returning match level.
func (r *DB) FindResidentialBestMatch(ctx context.Context, lgCode, machiazaID string, filter ResidentialFilter) (*ResidentialBestResult, error) {
	// Build match clauses from most specific to least specific.
	// Each clause defines a SQL condition and its corresponding match level.
	type clause struct {
		cond  string
		args  []any
		level ResidentialMatchLevel
	}

	var clauses []clause
	if filter.RsdtNum != "" && filter.RsdtNum2 != "" {
		clauses = append(clauses, clause{"rsdt_num = ? AND rsdt_num2 = ?", []any{filter.RsdtNum, filter.RsdtNum2}, MatchLevelRsdt2})
	}
	if filter.RsdtNum != "" {
		clauses = append(clauses, clause{"rsdt_num = ? AND rsdt_num2 IS NULL", []any{filter.RsdtNum}, MatchLevelRsdt})
	}
	clauses = append(clauses, clause{"rsdt_num IS NULL AND rsdt_num2 IS NULL", nil, MatchLevelBlk})

	// Generate CASE expression and OR filter from the same clause definitions.
	var caseSB, orSB strings.Builder
	var caseArgs, orArgs []any
	for i, c := range clauses {
		fmt.Fprintf(&caseSB, " WHEN %s THEN %d", c.cond, c.level)
		caseArgs = append(caseArgs, c.args...)
		if i > 0 {
			orSB.WriteString(" OR ")
		}
		fmt.Fprintf(&orSB, "(%s)", c.cond)
		orArgs = append(orArgs, c.args...)
	}

	query := `
		SELECT lg_code, machiaza_id, blk_id, rsdt_id, rsdt2_id,
			blk_num, rsdt_num, rsdt_num2,
			ST_X(geom) AS lon, ST_Y(geom) AS lat,
			CASE` + caseSB.String() + ` ELSE 0 END AS match_level
		FROM cache_rsdtdsp
		WHERE lg_code = ? AND machiaza_id = ? AND blk_num = ?
			AND (` + orSB.String() + `)
		ORDER BY match_level DESC LIMIT 1`

	args := make([]any, 0, len(caseArgs)+3+len(orArgs))
	args = append(args, caseArgs...)
	args = append(args, lgCode, machiazaID, filter.BlkNum)
	args = append(args, orArgs...)

	return r.scanResidentialBestMatch(ctx, query, args)
}

// scanResidentialBestMatch executes a query that includes a match_level column
// and scans the result into a ResidentialBestResult.
func (r *DB) scanResidentialBestMatch(ctx context.Context, query string, args []any) (*ResidentialBestResult, error) {
	var (
		lgCode, machiazaID     sql.NullString
		blkID, rsdtID, rsdt2ID sql.NullString
		blkNum, rsdtNum        sql.NullString
		rsdtNum2               sql.NullString
		lon, lat               sql.NullFloat64
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
			Lon:        scanOptFloat(lon),
			Lat:        scanOptFloat(lat),
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
		lgCode, machiazaID sql.NullString
		prcID, prcNum1     sql.NullString
		prcNum2, prcNum3   sql.NullString
		lon, lat           sql.NullFloat64
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
		Lon:        scanOptFloat(lon),
		Lat:        scanOptFloat(lat),
	}, nil
}

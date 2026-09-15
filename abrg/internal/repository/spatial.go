package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"abrg/internal/model"
)

// prefFilter returns a prefecture filter clause for SQL.
func prefFilter(alias, pref string) (string, error) {
	if pref == "" || pref == model.All {
		return "", nil
	}
	code, err := strconv.Atoi(pref)
	if err != nil {
		return "", fmt.Errorf("invalid prefecture code %q: %w", pref, err)
	}
	return fmt.Sprintf("AND %s.pref_code = %d", alias, code), nil
}

// Every reverse query orders by distance, then lg_code and machiaza_id, so the
// result is reproducible: several machiaza can sit on one coordinate (Kyoto
// street names, for one), and with distance alone the parallel scan decides
// which tied row LIMIT keeps.
//
// The detail tables are not also ordered by their own ids: sorting on those
// high-cardinality columns is costly, and the ties left are between rows of a
// single machiaza.

// reverseAddrColumns are the address columns every reverse result carries, in
// the order reverseBaseScan.appendAddrPtrs scans them. They always come from
// cache_machiaza, aliased b.
const reverseAddrColumns = "b.pref, b.county, b.city, b.ward, b.kyoto_st, b.oaza_cho, b.chome, b.koaza, b.machiaza_dist"

// qualifyColumns prefixes each column with a table alias.
func qualifyColumns(alias string, cols []string) string {
	out := make([]string, len(cols))
	for i, c := range cols {
		out[i] = alias + "." + c
	}
	return strings.Join(out, ", ")
}

// FindNearestBasic finds the nearest basic (town-level) addresses.
func (r *DB) FindNearestBasic(ctx context.Context, params SpatialParams) ([]ReverseBaseFields, error) {
	pf, err := prefFilter("b", params.Pref)
	if err != nil {
		return nil, err
	}
	query := nearestScan("cache_machiaza", "b",
		reverseAddrColumns+", b.rsdt_addr_flg, b.lg_code, b.machiaza_id", pf, params)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanBasicResult)
}

// nearestScan selects cols, lon, lat and distance from table, nearest first.
func nearestScan(table, alias, cols, prefClause string, params SpatialParams) string {
	return fmt.Sprintf(`
		SELECT
			%[3]s,
			`+coordColumns+`,
			%[4]s AS distance
		FROM %[1]s %[2]s
		WHERE 1=1
			%[5]s
			AND %[6]s
		ORDER BY distance, %[2]s.lg_code, %[2]s.machiaza_id
		LIMIT %[7]d
	`,
		table,
		alias,
		cols,
		distanceExpr(alias, params.Lon, params.Lat),
		prefClause,
		withinRadiusExpr(alias, params.Lon, params.Lat, params.Radius),
		params.Limit,
	)
}

// nearestDetailQuery builds the query for cache_rsdtdsp or cache_parcel. It
// limits the rows before joining cache_machiaza. detailCols are in the order
// the row scanner expects.
func nearestDetailQuery(table, alias string, detailCols []string, prefClause string, params SpatialParams) string {
	cols := alias + ".lg_code, " + alias + ".machiaza_id, " + qualifyColumns(alias, detailCols)
	return fmt.Sprintf(`
		WITH nearest AS (%s)
		SELECT
			`+reverseAddrColumns+`,
			%s,
			b.rsdt_addr_flg,
			n.lg_code,
			n.machiaza_id,
			n.lon,
			n.lat,
			n.distance
		FROM nearest n
		LEFT JOIN cache_machiaza b ON n.lg_code = b.lg_code AND n.machiaza_id = b.machiaza_id
		ORDER BY n.distance, n.lg_code, n.machiaza_id
	`, nearestScan(table, alias, cols, prefClause, params), qualifyColumns("n", detailCols))
}

// FindNearestResidential finds the nearest residential addresses.
func (r *DB) FindNearestResidential(ctx context.Context, params SpatialParams) ([]ReverseResidentialResult, error) {
	pf, err := prefFilter("r", params.Pref)
	if err != nil {
		return nil, err
	}
	query := nearestDetailQuery("cache_rsdtdsp", "r",
		[]string{"blk_id", "rsdt_id", "rsdt2_id", "blk_num", "rsdt_num", "rsdt_num2"}, pf, params)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanResidentialResult)
}

// FindNearestParcel finds the nearest parcel addresses.
func (r *DB) FindNearestParcel(ctx context.Context, params SpatialParams) ([]ReverseParcelResult, error) {
	pf, err := prefFilter("p", params.Pref)
	if err != nil {
		return nil, err
	}
	query := nearestDetailQuery("cache_parcel", "p",
		[]string{"prc_id", "prc_num1", "prc_num2", "prc_num3"}, pf, params)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanParcelResult)
}

// reverseBaseScan holds scan variables for the common address fields in reverse queries.
type reverseBaseScan struct {
	pref, county, city, ward       sql.Null[string]
	kyotoSt, oazaCho, chome, koaza sql.Null[string]
	machiazaDist, rsdtAddrFlg      sql.Null[string]
	lgCode, machiazaID             sql.Null[string]
	lon, lat, distance             float64
}

// appendAddrPtrs appends scan destinations for reverseAddrColumns to dst.
func (v *reverseBaseScan) appendAddrPtrs(dst []any) []any {
	return append(dst, &v.pref, &v.county, &v.city, &v.ward, &v.kyotoSt, &v.oazaCho, &v.chome, &v.koaza, &v.machiazaDist)
}

// appendTailPtrs appends scan destinations for rsdt_addr_flg through distance to dst.
func (v *reverseBaseScan) appendTailPtrs(dst []any) []any {
	return append(dst, &v.rsdtAddrFlg, &v.lgCode, &v.machiazaID, &v.lon, &v.lat, &v.distance)
}

func (v *reverseBaseScan) build() ReverseBaseFields {
	return ReverseBaseFields{
		Pref:         scanStr(v.pref),
		County:       scanOpt(v.county),
		City:         scanStr(v.city),
		Ward:         scanOpt(v.ward),
		KyotoSt:      scanOpt(v.kyotoSt),
		OazaCho:      scanOpt(v.oazaCho),
		Chome:        scanOpt(v.chome),
		Koaza:        scanOpt(v.koaza),
		MachiazaDist: scanOpt(v.machiazaDist),
		RsdtAddrFlg:  scanOpt(v.rsdtAddrFlg),
		LgCode:       scanStr(v.lgCode),
		MachiazaID:   scanStr(v.machiazaID),
		Lon:          v.lon,
		Lat:          v.lat,
		Distance:     v.distance,
	}
}

func scanBasicResult(rows *sql.Rows) (ReverseBaseFields, error) {
	var v reverseBaseScan
	dest := make([]any, 0, 15)
	dest = v.appendAddrPtrs(dest)
	dest = v.appendTailPtrs(dest)
	if err := rows.Scan(dest...); err != nil {
		return ReverseBaseFields{}, err
	}
	return v.build(), nil
}

func scanResidentialResult(rows *sql.Rows) (ReverseResidentialResult, error) {
	var v reverseBaseScan
	var blkID, rsdtID, rsdt2ID, blkNum, rsdtNum, rsdtNum2 sql.Null[string]
	dest := make([]any, 0, 21)
	dest = v.appendAddrPtrs(dest)
	dest = append(dest, &blkID, &rsdtID, &rsdt2ID, &blkNum, &rsdtNum, &rsdtNum2)
	dest = v.appendTailPtrs(dest)
	if err := rows.Scan(dest...); err != nil {
		return ReverseResidentialResult{}, err
	}
	return ReverseResidentialResult{
		ReverseBaseFields: v.build(),
		BlkID:             scanOpt(blkID),
		RsdtID:            scanOpt(rsdtID),
		Rsdt2ID:           scanOpt(rsdt2ID),
		BlkNum:            scanOpt(blkNum),
		RsdtNum:           scanOpt(rsdtNum),
		RsdtNum2:          scanOpt(rsdtNum2),
	}, nil
}

func scanParcelResult(rows *sql.Rows) (ReverseParcelResult, error) {
	var v reverseBaseScan
	var prcID, prcNum1, prcNum2, prcNum3 sql.Null[string]
	dest := make([]any, 0, 19)
	dest = v.appendAddrPtrs(dest)
	dest = append(dest, &prcID, &prcNum1, &prcNum2, &prcNum3)
	dest = v.appendTailPtrs(dest)
	if err := rows.Scan(dest...); err != nil {
		return ReverseParcelResult{}, err
	}
	return ReverseParcelResult{
		ReverseBaseFields: v.build(),
		PrcID:             scanOpt(prcID),
		PrcNum1:           scanOpt(prcNum1),
		PrcNum2:           scanOpt(prcNum2),
		PrcNum3:           scanOpt(prcNum3),
	}, nil
}

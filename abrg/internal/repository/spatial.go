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

// Every reverse query orders by distance and then by lg_code and machiaza_id.
// The tie-break is what makes the result reproducible: several machiaza can sit
// on one coordinate (Kyoto street names, for one), and ordering by distance
// alone leaves the parallel scan to decide which of the tied rows LIMIT keeps,
// so the same query returned different rows from run to run.
//
// For cache_machiaza that pair is the primary key, so the order is total. For
// the detail tables it orders down to the machiaza only; adding the rows' own
// ids would make it total there too, but sorting the candidate set on those
// high-cardinality columns costs several times the query time, and the ties
// left unresolved are between detail rows of a single machiaza.

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

// FindNearestBasic finds the nearest basic (town-level) addresses using spatial queries.
// Note: Values are embedded directly in SQL because DuckDB R-Tree requires constants
// known at query planning time for index optimization.
func (r *DB) FindNearestBasic(ctx context.Context, params SpatialParams) ([]ReverseBaseFields, error) {
	pf, err := prefFilter("b", params.Pref)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`
		SELECT
			`+reverseAddrColumns+`,
			b.rsdt_addr_flg,
			b.lg_code,
			b.machiaza_id,
			ST_X(b.geom) AS lon,
			ST_Y(b.geom) AS lat,
			ST_Distance_Sphere(b.geom, ST_Point(%f, %f)) AS distance
		FROM cache_machiaza b
		WHERE 1=1
			%s
			AND ST_Intersects(b.geom, ST_Buffer(ST_Point(%f, %f), %f))
		ORDER BY distance, b.lg_code, b.machiaza_id
		LIMIT %d
	`, params.Lon, params.Lat, pf, params.Lon, params.Lat, params.Radius, params.Limit)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanBasicResult)
}

// nearestDetailQuery builds the spatial query for a detail table (rsdtdsp or
// parcel). The CTE applies LIMIT before the JOIN so only the matched rows are
// joined back to cache_machiaza. detailCols are the table's own id and number
// columns, selected in the order the row scanner expects.
func nearestDetailQuery(table, alias string, detailCols []string, prefClause string, params SpatialParams) string {
	return fmt.Sprintf(`
		WITH nearest AS (
			SELECT
				%[2]s.lg_code,
				%[2]s.machiaza_id,
				%[3]s,
				ST_X(%[2]s.geom) AS lon,
				ST_Y(%[2]s.geom) AS lat,
				ST_Distance_Sphere(%[2]s.geom, ST_Point(%[5]f, %[6]f)) AS distance
			FROM %[1]s %[2]s
			WHERE 1=1
				%[7]s
				AND ST_Intersects(%[2]s.geom, ST_Buffer(ST_Point(%[5]f, %[6]f), %[8]f))
			ORDER BY distance, %[2]s.lg_code, %[2]s.machiaza_id
			LIMIT %[9]d
		)
		SELECT
			`+reverseAddrColumns+`,
			%[4]s,
			b.rsdt_addr_flg,
			n.lg_code,
			n.machiaza_id,
			n.lon,
			n.lat,
			n.distance
		FROM nearest n
		LEFT JOIN cache_machiaza b ON n.lg_code = b.lg_code AND n.machiaza_id = b.machiaza_id
		ORDER BY n.distance, n.lg_code, n.machiaza_id
	`,
		table,
		alias,
		qualifyColumns(alias, detailCols),
		qualifyColumns("n", detailCols),
		params.Lon,
		params.Lat,
		prefClause,
		params.Radius,
		params.Limit,
	)
}

// FindNearestResidential finds the nearest residential addresses using spatial queries.
func (r *DB) FindNearestResidential(ctx context.Context, params SpatialParams) ([]ReverseResidentialResult, error) {
	pf, err := prefFilter("r", params.Pref)
	if err != nil {
		return nil, err
	}
	query := nearestDetailQuery("cache_rsdtdsp", "r",
		[]string{"blk_id", "rsdt_id", "rsdt2_id", "blk_num", "rsdt_num", "rsdt_num2"}, pf, params)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanResidentialResult)
}

// FindNearestParcel finds the nearest parcel addresses using spatial queries.
func (r *DB) FindNearestParcel(ctx context.Context, params SpatialParams) ([]ReverseParcelResult, error) {
	pf, err := prefFilter("p", params.Pref)
	if err != nil {
		return nil, err
	}
	query := nearestDetailQuery("cache_parcel", "p",
		[]string{"prc_id", "prc_num1", "prc_num2", "prc_num3"}, pf, params)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanParcelResult)
}

// reverseBaseScan holds scan variables for the common address fields in spatial queries.
type reverseBaseScan struct {
	pref, county, city, ward       sql.Null[string]
	kyotoSt, oazaCho, chome, koaza sql.Null[string]
	machiazaDist, rsdtAddrFlg      sql.Null[string]
	lgCode, machiazaID             sql.Null[string]
	lon, lat, distance             float64
}

// appendAddrPtrs appends scan destination pointers for the 9 address columns
// (pref through machiaza_dist) to dst.
func (v *reverseBaseScan) appendAddrPtrs(dst []any) []any {
	return append(dst, &v.pref, &v.county, &v.city, &v.ward, &v.kyotoSt, &v.oazaCho, &v.chome, &v.koaza, &v.machiazaDist)
}

// appendTailPtrs appends scan destination pointers for the 6 trailing columns
// (rsdt_addr_flg through distance) to dst.
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

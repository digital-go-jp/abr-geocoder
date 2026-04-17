package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"

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
			b.pref,
			b.county,
			b.city,
			b.ward,
			b.kyoto_st,
			b.oaza_cho,
			b.chome,
			b.koaza,
			b.machiaza_dist,
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
		ORDER BY distance
		LIMIT %d
	`, params.Lon, params.Lat, pf, params.Lon, params.Lat, params.Radius, params.Limit)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanBasicResult)
}

// FindNearestResidential finds the nearest residential addresses using spatial queries.
// Uses CTE to apply LIMIT before JOIN for performance optimization.
func (r *DB) FindNearestResidential(ctx context.Context, params SpatialParams) ([]ReverseResidentialResult, error) {
	pf, err := prefFilter("r", params.Pref)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`
		WITH nearest AS (
			SELECT
				r.lg_code,
				r.machiaza_id,
				r.blk_id,
				r.rsdt_id,
				r.rsdt2_id,
				r.blk_num,
				r.rsdt_num,
				r.rsdt_num2,
				ST_X(r.geom) AS lon,
				ST_Y(r.geom) AS lat,
				ST_Distance_Sphere(r.geom, ST_Point(%f, %f)) AS distance
			FROM cache_rsdtdsp r
			WHERE 1=1
				%s
				AND ST_Intersects(r.geom, ST_Buffer(ST_Point(%f, %f), %f))
			ORDER BY distance
			LIMIT %d
		)
		SELECT
			b.pref,
			b.county,
			b.city,
			b.ward,
			b.kyoto_st,
			b.oaza_cho,
			b.chome,
			b.koaza,
			b.machiaza_dist,
			n.blk_id,
			n.rsdt_id,
			n.rsdt2_id,
			n.blk_num,
			n.rsdt_num,
			n.rsdt_num2,
			b.rsdt_addr_flg,
			n.lg_code,
			n.machiaza_id,
			n.lon,
			n.lat,
			n.distance
		FROM nearest n
		LEFT JOIN cache_machiaza b ON n.lg_code = b.lg_code AND n.machiaza_id = b.machiaza_id
		ORDER BY n.distance
	`, params.Lon, params.Lat, pf, params.Lon, params.Lat, params.Radius, params.Limit)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanResidentialResult)
}

// FindNearestParcel finds the nearest parcel addresses using spatial queries.
// Uses CTE to apply LIMIT before JOIN for performance optimization.
func (r *DB) FindNearestParcel(ctx context.Context, params SpatialParams) ([]ReverseParcelResult, error) {
	pf, err := prefFilter("p", params.Pref)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(`
		WITH nearest AS (
			SELECT
				p.lg_code,
				p.machiaza_id,
				p.prc_id,
				p.prc_num1,
				p.prc_num2,
				p.prc_num3,
				ST_X(p.geom) AS lon,
				ST_Y(p.geom) AS lat,
				ST_Distance_Sphere(p.geom, ST_Point(%f, %f)) AS distance
			FROM cache_parcel p
			WHERE 1=1
				%s
				AND ST_Intersects(p.geom, ST_Buffer(ST_Point(%f, %f), %f))
			ORDER BY distance
			LIMIT %d
		)
		SELECT
			b.pref,
			b.county,
			b.city,
			b.ward,
			b.kyoto_st,
			b.oaza_cho,
			b.chome,
			b.koaza,
			b.machiaza_dist,
			n.prc_id,
			n.prc_num1,
			n.prc_num2,
			n.prc_num3,
			b.rsdt_addr_flg,
			n.lg_code,
			n.machiaza_id,
			n.lon,
			n.lat,
			n.distance
		FROM nearest n
		LEFT JOIN cache_machiaza b ON n.lg_code = b.lg_code AND n.machiaza_id = b.machiaza_id
		ORDER BY n.distance
	`, params.Lon, params.Lat, pf, params.Lon, params.Lat, params.Radius, params.Limit)

	return queryRows(ctx, r.db, query, nil, params.Limit, scanParcelResult)
}

// reverseBaseScan holds scan variables for the common address fields in spatial queries.
type reverseBaseScan struct {
	pref, county, city, ward       sql.NullString
	kyotoSt, oazaCho, chome, koaza sql.NullString
	machiazaDist, rsdtAddrFlg      sql.NullString
	lgCode, machiazaID             sql.NullString
	lon, lat, distance             float64
}

// addrPtrs returns scan destination pointers for the 9 address columns (pref through machiaza_dist).
func (v *reverseBaseScan) addrPtrs() []any {
	return []any{&v.pref, &v.county, &v.city, &v.ward, &v.kyotoSt, &v.oazaCho, &v.chome, &v.koaza, &v.machiazaDist}
}

// tailPtrs returns scan destination pointers for the 6 trailing columns (rsdt_addr_flg through distance).
func (v *reverseBaseScan) tailPtrs() []any {
	return []any{&v.rsdtAddrFlg, &v.lgCode, &v.machiazaID, &v.lon, &v.lat, &v.distance}
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
	dest := append(v.addrPtrs(), v.tailPtrs()...)
	if err := rows.Scan(dest...); err != nil {
		return ReverseBaseFields{}, err
	}
	return v.build(), nil
}

func scanResidentialResult(rows *sql.Rows) (ReverseResidentialResult, error) {
	var v reverseBaseScan
	var blkID, rsdtID, rsdt2ID, blkNum, rsdtNum, rsdtNum2 sql.NullString
	dest := append(v.addrPtrs(), &blkID, &rsdtID, &rsdt2ID, &blkNum, &rsdtNum, &rsdtNum2)
	dest = append(dest, v.tailPtrs()...)
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
	var prcID, prcNum1, prcNum2, prcNum3 sql.NullString
	dest := append(v.addrPtrs(), &prcID, &prcNum1, &prcNum2, &prcNum3)
	dest = append(dest, v.tailPtrs()...)
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

package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"abrg/internal/model"
	"abrg/internal/util"
)

// basicColumns is the canonical column list for cache_machiaza queries.
// All queries selecting from cache_machiaza should use this constant to prevent
// column-order drift between SQL and Go scan calls.
const basicColumns = `normalized_address, lg_code, machiaza_id, rsdt_addr_flg,
	pref, county, city, ward, kyoto_st, oaza_cho, chome, koaza, machiaza_dist,
	has_chome, parcel_count, rsdtdsp_count, ST_X(geom) AS lon, ST_Y(geom) AS lat`

// FindBasicByAddress searches cache_machiaza by normalized_address.
func (r *DB) FindBasicByAddress(ctx context.Context, params BasicSearchParams) ([]BasicResult, error) {
	query := "SELECT " + basicColumns + " FROM cache_machiaza WHERE normalized_address = ?"

	args := []any{params.Address}
	if params.PrefCode != "" && params.PrefCode != model.All {
		query += " AND pref_code = ?"
		args = append(args, params.PrefCode)
	}

	query += " ORDER BY (parcel_count + rsdtdsp_count) DESC, machiaza_id DESC, lg_code, rsdt_addr_flg LIMIT ?"
	args = append(args, params.Limit)

	results, err := queryRows(ctx, r.db, query, args, params.Limit, scanBasicResultRow)
	if err != nil {
		return nil, fmt.Errorf("find basic by address %q: %w", params.Address, err)
	}
	return results, nil
}

// scanBasicResultRow scans a row matching basicColumns into a BasicResult.
func scanBasicResultRow(rows *sql.Rows) (BasicResult, error) {
	var (
		stdAddr, lgCode, machiazaID sql.NullString
		rsdtAddrFlg, pref, county   sql.NullString
		city, ward, kyotoSt         sql.NullString
		oazaCho, chome, koaza       sql.NullString
		machiazaDist                sql.NullString
		hasChome                    sql.NullBool
		parcelCount, rsdtdspCount   sql.NullInt64
		lon, lat                    sql.NullFloat64
	)
	if err := rows.Scan(
		&stdAddr, &lgCode, &machiazaID, &rsdtAddrFlg,
		&pref, &county, &city, &ward, &kyotoSt, &oazaCho, &chome, &koaza, &machiazaDist,
		&hasChome, &parcelCount, &rsdtdspCount,
		&lon, &lat,
	); err != nil {
		return BasicResult{}, err
	}
	return BasicResult{
		NormalizedAddress: scanStr(stdAddr),
		LgCode:            scanStr(lgCode),
		MachiazaID:        scanStr(machiazaID),
		RsdtAddrFlg:       scanOpt(rsdtAddrFlg),
		Pref:              scanStr(pref),
		County:            scanOpt(county),
		City:              scanStr(city),
		Ward:              scanOpt(ward),
		KyotoSt:           scanOpt(kyotoSt),
		OazaCho:           scanOpt(oazaCho),
		Chome:             scanOpt(chome),
		Koaza:             scanOpt(koaza),
		MachiazaDist:      scanOpt(machiazaDist),
		HasChome:          hasChome.Valid && hasChome.Bool,
		ParcelCount:       int(parcelCount.Int64),
		RsdtdspCount:      int(rsdtdspCount.Int64),
		Lon:               scanOptFloat(lon),
		Lat:               scanOptFloat(lat),
	}, nil
}

// Levenshtein search tuning constants.
const (
	// sqlLimitMultiplier is the factor by which the requested limit is multiplied for SQL queries.
	sqlLimitMultiplier = 10

	// minSQLLimit is the minimum number of candidates to retrieve from SQL.
	minSQLLimit = 10
)

// FindBasicByLevenshtein searches cache_machiaza using editdist3 for fuzzy matching.
func (r *DB) FindBasicByLevenshtein(ctx context.Context, p LevenshteinParams) ([]BasicResult, error) {
	maxEditDist := util.MaxEditDistance(len(p.SearchAddr))

	query := "SELECT " + basicColumns + " FROM cache_machiaza" +
		" WHERE editdist3(?, normalized_address) <= ?"
	args := []any{p.SearchAddr, maxEditDist}

	// Location filters
	if p.MachiazaID != "" && p.LgCode != "" {
		if p.MachiazaID == model.UnknownMachiazaID {
			query += " AND lg_code = ?"
			args = append(args, p.LgCode)
		} else {
			query += " AND lg_code = ? AND substr(machiaza_id, 1, 4) = substr(?, 1, 4)"
			args = append(args, p.LgCode, p.MachiazaID)
			// Filter by exact chome if searchAddr contains "@:"
			if chomeFilter, chomeArg := extractChomeFilter(p.SearchAddr); chomeFilter != "" {
				query += chomeFilter
				args = append(args, chomeArg)
			}
		}
	} else if p.LgCode != "" {
		query += " AND lg_code = ?"
		args = append(args, p.LgCode)
	} else if p.PrefCode != "" && p.PrefCode != model.All {
		query += " AND pref_code = ?"
		args = append(args, p.PrefCode)
	}

	sqlLimit := max(p.Limit*sqlLimitMultiplier, minSQLLimit)
	query += " ORDER BY editdist3(?, normalized_address) ASC, normalized_address ASC, lg_code, machiaza_id, rsdt_addr_flg LIMIT ?"
	args = append(args, p.SearchAddr, sqlLimit)

	results, err := queryRows(ctx, r.db, query, args, sqlLimit, scanBasicResultRow)
	if err != nil {
		return nil, fmt.Errorf("find basic by levenshtein %q: %w", p.SearchAddr, err)
	}
	return results, nil
}

// extractChomeFilter extracts a chome number from patterns like "久保田1@:23" where digits before "@:" are the chome.
func extractChomeFilter(searchAddr string) (string, string) {
	idx := strings.Index(searchAddr, "@:")
	if idx <= 0 {
		return "", ""
	}
	// Extract trailing digits before "@:"
	end := idx
	start := end
	for start > 0 && searchAddr[start-1] >= '0' && searchAddr[start-1] <= '9' {
		start--
	}
	if start == end {
		return "", ""
	}
	chomeNum, err := strconv.Atoi(searchAddr[start:end])
	if err != nil || chomeNum <= 0 || chomeNum > model.MaxChomeNumber {
		return "", ""
	}
	return " AND substr(machiaza_id, 5, 3) = ?", fmt.Sprintf("%03d", chomeNum)
}

// FindBasicByPrefix searches cache_machiaza where the DB address is a prefix of baseAddr.
func (r *DB) FindBasicByPrefix(ctx context.Context, p PrefixParams) ([]BasicResult, error) {
	query := "SELECT " + basicColumns + " FROM cache_machiaza WHERE ? LIKE normalized_address || '%'"
	args := []any{p.BaseAddr}

	if p.PrefCode != "" && p.PrefCode != model.All {
		query += " AND pref_code = ?"
		args = append(args, p.PrefCode)
	}

	query += " ORDER BY length(normalized_address) DESC, lg_code, machiaza_id, rsdt_addr_flg LIMIT ?"
	args = append(args, p.Limit)

	results, err := queryRows(ctx, r.db, query, args, p.Limit, scanBasicResultRow)
	if err != nil {
		return nil, fmt.Errorf("find basic by prefix %q: %w", p.BaseAddr, err)
	}
	return results, nil
}

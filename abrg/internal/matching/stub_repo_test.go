package matching

// Stub-repository tests for the matching orchestration layer. They run without
// a DuckDB cache: the repository interface is faked with rows copied from the
// production cache, and the expected feature JSON is pinned from the real
// pipeline output. This keeps the orchestration branches (category dispatch,
// two-stage search, fallback chain, city/prefecture records, Levenshtein
// fallback) exercised in CI where the cache-dependent suites are skipped.
//
// Provenance of the pinned expectations (for regeneration):
//   - Cache: a full nationwide cache (enabled_pref=all, enabled_category=all,
//     enabled_pos=true); the pinned result_info carries its db_version 3.0.12.
//   - Binary: the abrg CLI built from the commit that last updated the
//     expectations (any matching behavior change requires regeneration).
//   - Expected JSON: the features array of
//     printf '<address>\n' > in.txt &&
//     CACHE_PATH=$HOME/.abrg/cache/abrg.duckdb \
//       ./abrg match -q -c <category> -i in.txt -o out.json
//     (geocode cases use ./abrg geocode with the same flags).
//   - Fixture rows: the same cache queried read-only with the duckdb CLI
//     against cache_machiaza / cache_city / cache_pref / cache_rsdtdsp /
//     cache_parcel, coordinates rounded to 6 digits via round(ST_X(geom),6).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"slices"
	"strings"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/matchlevel"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// stubRepo implements implQuerier and matching.CoordinatesGetter with canned
// rows keyed by the query parameters. Unknown keys yield empty results, which
// is how the "not found" branches are reached. Every method records its full
// parameter set into calls so tests can pin the exact search conditions the
// orchestration issues, and errByMethod injects a failure into a method to
// pin error propagation.
type stubRepo struct {
	basicByAddr  map[string][]repository.BasicResult
	levenByAddr  map[string][]repository.BasicResult
	prefixByAddr map[string][]repository.BasicResult
	cityByPart   map[string]*repository.CityResult
	fuzzyByPart  map[string]*repository.CityResult
	prefByCode   map[string]*repository.PrefectureResult
	rsdtByKey    map[string]*repository.ResidentialBestResult
	parcelByKey  map[string]*repository.ParcelResult

	// Coordinate maps for the three tiers of the parent-coordinate fallback,
	// keyed like the corresponding cache tables.
	machiazaCoords map[string][]float64 // lgCode|machiazaID
	cityCoords     map[string][]float64 // lgCode
	prefCoords     map[string][]float64 // lgCode or 2-digit pref code

	errByMethod map[string]error
	calls       []string
}

func (s *stubRepo) record(format string, args ...any) {
	s.calls = append(s.calls, fmt.Sprintf(format, args...))
}

func (s *stubRepo) injected(method string) error {
	return s.errByMethod[method]
}

func (s *stubRepo) FindBasicByAddress(_ context.Context, params repository.BasicSearchParams) ([]repository.BasicResult, error) {
	s.record("FindBasicByAddress(%q, pref=%q, limit=%d)", params.Address, params.PrefCode, params.Limit)
	if err := s.injected("FindBasicByAddress"); err != nil {
		return nil, err
	}
	rows := s.basicByAddr[params.Address]
	if params.Limit > 0 && len(rows) > params.Limit {
		rows = rows[:params.Limit]
	}
	return rows, nil
}

func (s *stubRepo) FindBasicByLevenshtein(_ context.Context, params repository.LevenshteinParams) ([]repository.BasicResult, error) {
	s.record("FindBasicByLevenshtein(%q, pref=%q, lg=%q, machiaza=%q, limit=%d)",
		params.SearchAddr, params.PrefCode, params.LgCode, params.MachiazaID, params.Limit)
	if err := s.injected("FindBasicByLevenshtein"); err != nil {
		return nil, err
	}
	return s.levenByAddr[params.SearchAddr], nil
}

func (s *stubRepo) FindBasicByPrefix(_ context.Context, params repository.PrefixParams) ([]repository.BasicResult, error) {
	s.record("FindBasicByPrefix(%q, pref=%q, limit=%d)", params.BaseAddr, params.PrefCode, params.Limit)
	if err := s.injected("FindBasicByPrefix"); err != nil {
		return nil, err
	}
	return s.prefixByAddr[params.BaseAddr], nil
}

func (s *stubRepo) FindCityByAddress(_ context.Context, params repository.CitySearchParams) (*repository.CityResult, error) {
	s.record("FindCityByAddress(%q, lg=%q, pref=%q)", params.CityAddr, params.LgCode, params.PrefCode)
	return nil, s.injected("FindCityByAddress")
}

func (s *stubRepo) FindCityRecord(_ context.Context, params repository.CityRecordParams) (*repository.CityResult, error) {
	s.record("FindCityRecord(%q, pref=%q)", params.CityPart, params.PrefCode)
	if err := s.injected("FindCityRecord"); err != nil {
		return nil, err
	}
	return s.cityByPart[params.CityPart], nil
}

func (s *stubRepo) FindCityRecordFuzzy(_ context.Context, params repository.CityFuzzyParams) (*repository.CityResult, error) {
	s.record("FindCityRecordFuzzy(%q, pref=%q, dist=%d)", params.CityPart, params.PrefCode, params.MaxEditDistance)
	if err := s.injected("FindCityRecordFuzzy"); err != nil {
		return nil, err
	}
	return s.fuzzyByPart[params.CityPart], nil
}

func (s *stubRepo) FindCandidateLgCodes(_ context.Context, params repository.CityFuzzyParams) ([]string, error) {
	s.record("FindCandidateLgCodes(%q, pref=%q, dist=%d)", params.CityPart, params.PrefCode, params.MaxEditDistance)
	if err := s.injected("FindCandidateLgCodes"); err != nil {
		return nil, err
	}
	if cr := s.fuzzyByPart[params.CityPart]; cr != nil {
		return []string{cr.LgCode}, nil
	}
	return nil, nil
}

func (s *stubRepo) FindPrefecture(_ context.Context, prefCode string) (*repository.PrefectureResult, error) {
	s.record("FindPrefecture(%q)", prefCode)
	if err := s.injected("FindPrefecture"); err != nil {
		return nil, err
	}
	return s.prefByCode[prefCode], nil
}

func (s *stubRepo) FindResidentialBestMatch(_ context.Context, lgCode, machiazaID string, f repository.ResidentialFilter) (*repository.ResidentialBestResult, error) {
	key := strings.Join([]string{lgCode, machiazaID, f.BlkNum, f.RsdtNum, f.RsdtNum2}, "|")
	s.record("FindResidentialBestMatch(%s)", key)
	if err := s.injected("FindResidentialBestMatch"); err != nil {
		return nil, err
	}
	return s.rsdtByKey[key], nil
}

func (s *stubRepo) FindParcelExact(_ context.Context, lgCode, machiazaID string, f repository.ParcelFilter) (*repository.ParcelResult, error) {
	key := strings.Join([]string{lgCode, machiazaID, f.PrcNum1, f.PrcNum2, f.PrcNum3}, "|")
	s.record("FindParcelExact(%s)", key)
	if err := s.injected("FindParcelExact"); err != nil {
		return nil, err
	}
	return s.parcelByKey[key], nil
}

// Coordinates implements matching.CoordinatesGetter for the Geocode tests,
// mirroring the fallback tiers of repository.DB.Coordinates (impl.go):
// machiaza row → city row → prefecture row by lg_code → prefecture by code.
func (s *stubRepo) Coordinates(_ context.Context, lgCode, machiazaID string) ([]float64, model.MatchLevel) {
	s.record("Coordinates(%q, %q)", lgCode, machiazaID)
	if machiazaID != "" {
		if c, ok := s.machiazaCoords[lgCode+"|"+machiazaID]; ok {
			return c, matchlevel.DetermineMatchLevel(&model.IDs{LgCode: &lgCode, MachiazaID: &machiazaID})
		}
	}
	if c, ok := s.cityCoords[lgCode]; ok {
		return c, model.MatchLevelCity
	}
	if c, ok := s.prefCoords[lgCode]; ok {
		return c, model.MatchLevelPrefecture
	}
	if len(lgCode) >= model.LgCodePrefLength {
		if c, ok := s.prefCoords[lgCode[:model.LgCodePrefLength]]; ok {
			return c, model.MatchLevelPrefecture
		}
	}
	return nil, ""
}

// Fixture rows copied from the production cache (2026-07-26 build).
func newStubRepo() *stubRepo {
	kioicho := repository.BasicResult{
		NormalizedAddress: "1000代田区紀尾井町", LgCode: "131016", MachiazaID: "0056000",
		RsdtAddrFlg: new("1"), Pref: "東京都", City: "千代田区", OazaCho: new("紀尾井町"),
		ParcelCount: 155, RsdtdspCount: 93, Lon: new(139.734955), Lat: new(35.681412),
	}
	// 舞浜 base: one row per rsdt_addr_flg (0/1) → ambiguous flag (issue #262).
	maihamaBase0 := repository.BasicResult{
		NormalizedAddress: "浦安市舞浜", LgCode: "122271", MachiazaID: "0018000",
		RsdtAddrFlg: new("0"), Pref: "千葉県", City: "浦安市", OazaCho: new("舞浜"),
		HasChome: true, ParcelCount: 174, Lon: new(139.881638), Lat: new(35.632145),
	}
	maihamaBase1 := repository.BasicResult{
		NormalizedAddress: "浦安市舞浜", LgCode: "122271", MachiazaID: "0018000",
		RsdtAddrFlg: new("1"), Pref: "千葉県", City: "浦安市", OazaCho: new("舞浜"),
		HasChome: true, ParcelCount: 174,
	}
	maihama2 := repository.BasicResult{
		NormalizedAddress: "浦安市舞浜2@", LgCode: "122271", MachiazaID: "0018002",
		RsdtAddrFlg: new("1"), Pref: "千葉県", City: "浦安市", OazaCho: new("舞浜"), Chome: new("2丁目"),
		HasChome: true, ParcelCount: 710, RsdtdspCount: 766, Lon: new(139.882568), Lat: new(35.641823),
	}
	nishishinjuku2 := repository.BasicResult{
		NormalizedAddress: "新宿区西新宿2@", LgCode: "131041", MachiazaID: "0023002",
		RsdtAddrFlg: new("1"), Pref: "東京都", City: "新宿区", OazaCho: new("西新宿"), Chome: new("2丁目"),
		HasChome: true, ParcelCount: 71, RsdtdspCount: 11, Lon: new(139.691772), Lat: new(35.689449),
	}
	otaBase := repository.BasicResult{
		NormalizedAddress: "7尾市大田町", LgCode: "172022", MachiazaID: "0022000",
		RsdtAddrFlg: new("0"), Pref: "石川県", City: "七尾市", OazaCho: new("大田町"),
		Lon: new(137.01355), Lat: new(37.06189),
	}
	otaKoaza := repository.BasicResult{
		NormalizedAddress: "7尾市大田町111", LgCode: "172022", MachiazaID: "0022145",
		RsdtAddrFlg: new("0"), Pref: "石川県", City: "七尾市", OazaCho: new("大田町"), Koaza: new("111"),
		ParcelCount: 82,
	}
	// 大字南長野/県町: parcel_count=0 on the koaza record; parcel rows live under
	// the base machiaza_id 0231000 (base-machiaza fallback in searchParcel).
	kencho := repository.BasicResult{
		NormalizedAddress: "長野市南長野県町", LgCode: "202011", MachiazaID: "0231136",
		RsdtAddrFlg: new("0"), Pref: "長野県", City: "長野市", OazaCho: new("大字南長野"), Koaza: new("県町"),
	}

	return &stubRepo{
		basicByAddr: map[string][]repository.BasicResult{
			"1000代田区紀尾井町": {kioicho},
			"浦安市舞浜":       {maihamaBase0, maihamaBase1},
			"浦安市舞浜2@":     {maihama2},
			"新宿区西新宿2@":    {nishishinjuku2},
			"7尾市大田町":      {otaBase},
			"7尾市大田町111":   {otaKoaza},
			"長野市南長野県町":    {kencho},
		},
		levenByAddr: map[string][]repository.BasicResult{
			"1000代田区紀●井町:1-3": {kioicho},
		},
		prefixByAddr: map[string][]repository.BasicResult{},
		cityByPart: map[string]*repository.CityResult{
			"1000代田区": {LgCode: "131016", Pref: "東京都", City: "千代田区"},
			"鎌ガ谷市":    {LgCode: "122246", Pref: "千葉県", City: "鎌ケ谷市"},
			"柴田郡大河原町": {LgCode: "043214", Pref: "宮城県", County: new("柴田郡"), City: "大河原町"},
			"大阪市天王寺区": {LgCode: "271098", Pref: "大阪府", City: "大阪市", Ward: new("天王寺区")},
		},
		fuzzyByPart: map[string]*repository.CityResult{
			"●橋市": {LgCode: "122041", Pref: "千葉県", City: "船橋市"},
		},
		prefByCode: map[string]*repository.PrefectureResult{
			"13": {LgCode: "130001", PrefName: "東京都"},
		},
		rsdtByKey: map[string]*repository.ResidentialBestResult{
			"131016|0056000|1|3|": {
				ResidentialResult: repository.ResidentialResult{
					LgCode: new("131016"), MachiazaID: new("0056000"),
					BlkID: new("001"), RsdtID: new("003"), BlkNum: new("1"), RsdtNum: new("3"),
					Lon: new(139.736389), Lat: new(35.679108),
				},
				MatchLevel: repository.MatchLevelRsdt,
			},
			"131016|0056000|1|99|": {
				ResidentialResult: repository.ResidentialResult{
					LgCode: new("131016"), MachiazaID: new("0056000"),
					BlkID: new("001"), BlkNum: new("1"),
					Lon: new(139.737183), Lat: new(35.67992),
				},
				MatchLevel: repository.MatchLevelBlk,
			},
			"122271|0018002|11||": {
				ResidentialResult: repository.ResidentialResult{
					LgCode: new("122271"), MachiazaID: new("0018002"),
					BlkID: new("011"), BlkNum: new("11"),
					Lon: new(139.880875), Lat: new(35.641178),
				},
				MatchLevel: repository.MatchLevelBlk,
			},
		},
		parcelByKey: map[string]*repository.ParcelResult{
			"122271|0018000|2|11|": {
				LgCode: new("122271"), MachiazaID: new("0018000"),
				PrcID: new("000020001100000"), PrcNum1: new("2"), PrcNum2: new("11"),
			},
			"172022|0022145|11||": {
				LgCode: new("172022"), MachiazaID: new("0022145"),
				PrcID: new("000110000000000"), PrcNum1: new("11"),
			},
			"202011|0231000|1217|4|": {
				LgCode: new("202011"), MachiazaID: new("0231000"),
				PrcID: new("012170000400000"), PrcNum1: new("1217"), PrcNum2: new("4"),
			},
		},
		cityCoords: map[string][]float64{
			"122246": {140.000732, 35.776764},
			"172022": {136.9673, 37.04311},
		},
	}
}

// newStubLookups mirrors the production lookup tables (raw city names, not
// normalized) for the cities involved in the fixtures.
func newStubLookups() cache.Lookups {
	return cache.Lookups{
		CityPrefCodes: map[string]string{
			"千代田区": "13", "新宿区": "13", "浦安市": "12", "鎌ケ谷市": "12",
			"大河原町": "04", "船橋市": "12", "大阪市": "27", "七尾市": "17", "長野市": "20",
		},
		CityWardLgCodes: map[string]string{
			"千代田区": "131016", "新宿区": "131041", "浦安市": "122271", "鎌ケ谷市": "122246",
			"大河原町": "043214", "柴田郡大河原町": "043214", "船橋市": "122041",
			"大阪市天王寺区": "271098", "七尾市": "172022", "長野市": "202011",
		},
		CityBoundary: util.NewCityBoundary([]string{
			"千代田区", "新宿区", "浦安市", "鎌ケ谷市", "大河原町", "柴田郡大河原町",
			"船橋市", "大阪市天王寺区", "七尾市", "長野市",
		}),
	}
}

func newStubMatcher() (*Impl, *stubRepo) {
	repo := newStubRepo()
	return NewMatcher(repo, newStubLookups(), true, true), repo
}

// assertFeaturesJSON compares got (marshalled) against the pinned JSON from the
// real pipeline, ignoring formatting.
func assertFeaturesJSON(t *testing.T, repo *stubRepo, got []model.MatchedResult, wantJSON string) {
	t.Helper()
	gotJSON, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal features: %v", err)
	}
	var gotAny, wantAny any
	if err := json.Unmarshal(gotJSON, &gotAny); err != nil {
		t.Fatalf("unmarshal got: %v", err)
	}
	if err := json.Unmarshal([]byte(wantJSON), &wantAny); err != nil {
		t.Fatalf("unmarshal want: %v", err)
	}
	if !reflect.DeepEqual(gotAny, wantAny) {
		t.Errorf("features mismatch\ngot:  %s\nwant: %s\nrepo calls:\n  %s",
			gotJSON, wantJSON, strings.Join(repo.calls, "\n  "))
	}
}

// TestMatch_StubRepo pins the observable Match output for the main orchestration
// branches. Expected JSON is the features array produced by the real pipeline
// with the full nationwide cache for the same query.
func TestMatch_StubRepo(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		category model.Category
		wantJSON string
		// wantCalls, when set, pins the exact repository call sequence with
		// full parameters for one representative scenario per category.
		wantCalls []string
	}{
		{
			// category=basic: machiaza hit + unmatched numbers (handleBasicFallback).
			name: "basic machiaza with unmatched numbers", address: "東京都千代田区紀尾井町1-3", category: model.CategoryBasic,
			wantCalls: []string{
				`FindBasicByAddress("1000代田区紀尾井町", pref="13", limit=5)`,
				`FindBasicByAddress("1000代田区紀尾井町1", pref="13", limit=5)`,
			},
			wantJSON: `[{"matched_address":"東京都千代田区紀尾井町","unmatched_address":["1-3"],"match_level":"machiaza","score":1,"ids":{"lg_code":"131016","machiaza_id":"0056000","rsdt_addr_flg":"1","blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"千代田区","ward":null,"kyoto_st":null,"oaza_cho":"紀尾井町","chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// category=rsdtdsp: two-stage residential full rsdt match.
			name: "rsdtdsp full match", address: "東京都千代田区紀尾井町1-3", category: model.CategoryResidential,
			wantJSON: `[{"matched_address":"東京都千代田区紀尾井町1-3","unmatched_address":null,"match_level":"rsdtdsp_rsdt","score":1,"ids":{"lg_code":"131016","machiaza_id":"0056000","rsdt_addr_flg":"1","blk_id":"001","rsdt_id":"003","rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"千代田区","ward":null,"kyoto_st":null,"oaza_cho":"紀尾井町","chome":null,"koaza":null,"machiaza_dist":null,"blk_num":"1","rsdt_num":"3","rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// category=rsdtdsp: blk-level partial match leaves "-99" unmatched.
			name: "rsdtdsp blk partial match", address: "東京都千代田区紀尾井町1-99", category: model.CategoryResidential,
			wantJSON: `[{"matched_address":"東京都千代田区紀尾井町1","unmatched_address":["-99"],"match_level":"rsdtdsp_blk","score":1,"ids":{"lg_code":"131016","machiaza_id":"0056000","rsdt_addr_flg":"1","blk_id":"001","rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"千代田区","ward":null,"kyoto_st":null,"oaza_cho":"紀尾井町","chome":null,"koaza":null,"machiaza_dist":null,"blk_num":"1","rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// category=parcel: no parcel row 1-3 → falls back to machiaza (tryTwoStageOrFallback).
			name: "parcel miss falls back to machiaza", address: "東京都千代田区紀尾井町1-3", category: model.CategoryParcel,
			wantJSON: `[{"matched_address":"東京都千代田区紀尾井町","unmatched_address":["1-3"],"match_level":"machiaza","score":1,"ids":{"lg_code":"131016","machiaza_id":"0056000","rsdt_addr_flg":"1","blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"千代田区","ward":null,"kyoto_st":null,"oaza_cho":"紀尾井町","chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// category=all: undetermined type resolves via residential (normalizeAll).
			name: "all resolves residential", address: "東京都千代田区紀尾井町1-3", category: model.CategoryAll,
			wantJSON: `[{"matched_address":"東京都千代田区紀尾井町1-3","unmatched_address":null,"match_level":"rsdtdsp_rsdt","score":1,"ids":{"lg_code":"131016","machiaza_id":"0056000","rsdt_addr_flg":"1","blk_id":"001","rsdt_id":"003","rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"千代田区","ward":null,"kyoto_st":null,"oaza_cho":"紀尾井町","chome":null,"koaza":null,"machiaza_dist":null,"blk_num":"1","rsdt_num":"3","rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// tryChomeSearch: base machiaza has has_chome=true, chome record found.
			name: "basic chome search", address: "千葉県浦安市舞浜2", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"千葉県浦安市舞浜2丁目","unmatched_address":null,"match_level":"machiaza_detail","score":1,"ids":{"lg_code":"122271","machiaza_id":"0018002","rsdt_addr_flg":"1","blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"千葉県","county":null,"city":"浦安市","ward":null,"kyoto_st":null,"oaza_cho":"舞浜","chome":"2丁目","koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// two-stage residential with chome-adjusted machiaza_id (0018000 → 0018002).
			name: "rsdtdsp chome adjustment", address: "千葉県浦安市舞浜2-11", category: model.CategoryResidential,
			wantCalls: []string{
				`FindBasicByAddress("浦安市舞浜", pref="12", limit=5)`,
				`FindResidentialBestMatch(122271|0018002|11||)`,
			},
			wantJSON: `[{"matched_address":"千葉県浦安市舞浜2丁目11","unmatched_address":null,"match_level":"rsdtdsp_blk","score":1,"ids":{"lg_code":"122271","machiaza_id":"0018002","rsdt_addr_flg":"1","blk_id":"011","rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"千葉県","county":null,"city":"浦安市","ward":null,"kyoto_st":null,"oaza_cho":"舞浜","chome":"2丁目","koaza":null,"machiaza_dist":null,"blk_num":"11","rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// two-stage parcel: chome-adjusted attempt misses, plain 2-11 hits.
			// rsdt_addr_flg is null because the base machiaza has one row per flag (issue #262).
			name: "parcel with ambiguous rsdt flag", address: "千葉県浦安市舞浜2-11", category: model.CategoryParcel,
			wantCalls: []string{
				`FindBasicByAddress("浦安市舞浜", pref="12", limit=5)`,
				`FindParcelExact(122271|0018000|11||)`,
				`FindParcelExact(122271|0018000|2|11|)`,
			},
			wantJSON: `[{"matched_address":"千葉県浦安市舞浜2-11","unmatched_address":null,"match_level":"parcel","score":1,"ids":{"lg_code":"122271","machiaza_id":"0018000","rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":"000020001100000"},"structured_address":{"pref":"千葉県","county":null,"city":"浦安市","ward":null,"kyoto_st":null,"oaza_cho":"舞浜","chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":"2","prc_num2":"11","prc_num3":null}}]`,
		},
		{
			// category=all: residential blk beats parcel in sortAndLimitResults.
			name: "all prefers residential over parcel", address: "千葉県浦安市舞浜2-11", category: model.CategoryAll,
			wantJSON: `[{"matched_address":"千葉県浦安市舞浜2丁目11","unmatched_address":null,"match_level":"rsdtdsp_blk","score":1,"ids":{"lg_code":"122271","machiaza_id":"0018002","rsdt_addr_flg":"1","blk_id":"011","rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"千葉県","county":null,"city":"浦安市","ward":null,"kyoto_st":null,"oaza_cho":"舞浜","chome":"2丁目","koaza":null,"machiaza_dist":null,"blk_num":"11","rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// searchParcel base-machiaza fallback: koaza record has parcel_count=0,
			// parcel rows live under base machiaza_id; original id is kept in the result.
			name: "parcel base machiaza fallback", address: "長野県長野市南長野県町1217-4", category: model.CategoryParcel,
			wantJSON: `[{"matched_address":"長野県長野市大字南長野県町1217-4","unmatched_address":null,"match_level":"parcel","score":1,"ids":{"lg_code":"202011","machiaza_id":"0231136","rsdt_addr_flg":"0","blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":"012170000400000"},"structured_address":{"pref":"長野県","county":null,"city":"長野市","ward":null,"kyoto_st":null,"oaza_cho":"大字南長野","chome":null,"koaza":"県町","machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":"1217","prc_num2":"4","prc_num3":null}}]`,
		},
		{
			// tryMachiazaFallbackSearch: base 西新宿 has no record, 西新宿2@ hits.
			name: "basic machiaza chome fallback search", address: "東京都新宿区西新宿2-8-1", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"東京都新宿区西新宿2丁目","unmatched_address":["8-1"],"match_level":"machiaza_detail","score":1,"ids":{"lg_code":"131041","machiaza_id":"0023002","rsdt_addr_flg":"1","blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"新宿区","ward":null,"kyoto_st":null,"oaza_cho":"西新宿","chome":"2丁目","koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// tryNumericKoazaSearch: number reinterpreted as koaza, remainder as parcel (issue #259).
			name: "all numeric koaza with parcel", address: "石川県七尾市大田町111-11", category: model.CategoryAll,
			wantJSON: `[{"matched_address":"石川県七尾市大田町111-11","unmatched_address":null,"match_level":"parcel","score":1,"ids":{"lg_code":"172022","machiaza_id":"0022145","rsdt_addr_flg":"0","blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":"000110000000000"},"structured_address":{"pref":"石川県","county":null,"city":"七尾市","ward":null,"kyoto_st":null,"oaza_cho":"大田町","chome":null,"koaza":"111","machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":"11","prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// queryCityRecord: city-only input fully matched at city level.
			name: "basic city record", address: "千葉県鎌ケ谷市", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"千葉県鎌ケ谷市","unmatched_address":null,"match_level":"city","score":0.3,"ids":{"lg_code":"122246","machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"千葉県","county":null,"city":"鎌ケ谷市","ward":null,"kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// queryCityRecord with county in the matched address.
			name: "basic city record with county", address: "宮城県柴田郡大河原町", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"宮城県柴田郡大河原町","unmatched_address":null,"match_level":"city","score":0.3,"ids":{"lg_code":"043214","machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"宮城県","county":"柴田郡","city":"大河原町","ward":null,"kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// queryCityRecordFuzzy: masked city name resolved via edit distance.
			name: "basic fuzzy city record", address: "千葉県●橋市", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"千葉県船橋市","unmatched_address":null,"match_level":"city","score":0.3,"ids":{"lg_code":"122041","machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"千葉県","county":null,"city":"船橋市","ward":null,"kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// detectCityPrefectureCode: no prefecture in input, resolved from city prefix map.
			name: "basic city without prefecture", address: "大阪市天王寺区", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"大阪府大阪市天王寺区","unmatched_address":null,"match_level":"city","score":0.3,"ids":{"lg_code":"271098","machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"大阪府","county":null,"city":"大阪市","ward":"天王寺区","kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// queryPrefectureRecord: prefecture-only input.
			name: "basic prefecture only", address: "東京都", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"東京都","unmatched_address":null,"match_level":"pref","score":0.1,"ids":{"lg_code":"130001","machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":null,"ward":null,"kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// handleFallback last resort after Levenshtein and prefix search miss.
			name: "basic prefecture fallback after search misses", address: "東京都神田鍛冶町二丁目", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"東京都","unmatched_address":["神田鍛冶町二丁目"],"match_level":"pref","score":0.1,"ids":{"lg_code":"130001","machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":null,"ward":null,"kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// CreateUnmatchedResult: nothing detected at all.
			name: "all completely unmatched", address: "存在しない住所", category: model.CategoryAll,
			wantJSON: `[{"matched_address":"","unmatched_address":["存在しない住所"],"match_level":"unknown","score":-1,"ids":{"lg_code":null,"machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":null,"county":null,"city":null,"ward":null,"kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// tryLevenshteinFallback + fuzzyMatchAllowsTwoStage: same-length substitution
			// resolves the rsdt detail, capped to the fuzzy town score (#246).
			name: "all levenshtein fallback resolves detail", address: "東京都千代田区紀●井町1-3", category: model.CategoryAll,
			wantCalls: []string{
				// First try: base before the colon; second try repeats the base
				// inside detectMachiaza for the full colon form, then falls back
				// to the chome pattern 1@ before Levenshtein resolves the town.
				`FindBasicByAddress("1000代田区紀●井町", pref="13", limit=5)`,
				`FindBasicByAddress("1000代田区紀●井町", pref="13", limit=5)`,
				`FindBasicByAddress("1000代田区紀●井町1@", pref="13", limit=5)`,
				`FindBasicByLevenshtein("1000代田区紀●井町:1-3", pref="13", lg="", machiaza="", limit=1)`,
				`FindResidentialBestMatch(131016|0056000|1|3|)`,
			},
			wantJSON: `[{"matched_address":"東京都千代田区紀尾井町1-3","unmatched_address":null,"match_level":"rsdtdsp_rsdt","score":0.67,"ids":{"lg_code":"131016","machiaza_id":"0056000","rsdt_addr_flg":"1","blk_id":"001","rsdt_id":"003","rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"千代田区","ward":null,"kyoto_st":null,"oaza_cho":"紀尾井町","chome":null,"koaza":null,"machiaza_dist":null,"blk_num":"1","rsdt_num":"3","rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
		{
			// category=basic with a masked machiaza: the city record wins before Levenshtein.
			name: "basic masked machiaza falls back to city", address: "東京都千代田区紀●井町1-3", category: model.CategoryBasic,
			wantJSON: `[{"matched_address":"東京都千代田区","unmatched_address":["紀●井町1-3"],"match_level":"city","score":0.3,"ids":{"lg_code":"131016","machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"千代田区","ward":null,"kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matcher, repo := newStubMatcher()
			resp, err := matcher.Match(t.Context(), model.MatchQuery{
				Address:  tt.address,
				Category: tt.category,
				Pref:     model.All,
				Limit:    1,
			})
			if err != nil {
				t.Fatalf("Match: %v\nrepo calls:\n  %s", err, strings.Join(repo.calls, "\n  "))
			}
			assertFeaturesJSON(t, repo, resp.Features, tt.wantJSON)
			if tt.wantCalls != nil && !slices.Equal(repo.calls, tt.wantCalls) {
				t.Errorf("repo call sequence mismatch\ngot:\n  %s\nwant:\n  %s",
					strings.Join(repo.calls, "\n  "), strings.Join(tt.wantCalls, "\n  "))
			}
		})
	}
}

// TestMatch_RepoErrorPropagation pins that repository failures on the main
// query paths surface as Match errors instead of degrading to a fixed result.
func TestMatch_RepoErrorPropagation(t *testing.T) {
	sentinel := errors.New("stub repo failure")

	tests := []struct {
		name        string
		method      string
		address     string
		category    model.Category
		wantMessage string
	}{
		{
			name: "basic search failure", method: "FindBasicByAddress",
			address: "東京都千代田区紀尾井町1-3", category: model.CategoryBasic,
			wantMessage: "detect basic results",
		},
		{
			name: "levenshtein failure", method: "FindBasicByLevenshtein",
			address: "東京都千代田区紀●井町1-3", category: model.CategoryAll,
			wantMessage: "database query failed",
		},
		{
			name: "two-stage residential failure", method: "FindResidentialBestMatch",
			address: "千葉県浦安市舞浜2-11", category: model.CategoryResidential,
			wantMessage: "residential search",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matcher, repo := newStubMatcher()
			repo.errByMethod = map[string]error{tt.method: sentinel}
			_, err := matcher.Match(t.Context(), model.MatchQuery{
				Address:  tt.address,
				Category: tt.category,
				Pref:     model.All,
				Limit:    1,
			})
			if !errors.Is(err, sentinel) {
				t.Fatalf("err = %v, want wrapped sentinel", err)
			}
			if !strings.Contains(err.Error(), tt.wantMessage) {
				t.Errorf("err = %q, want it to contain %q", err, tt.wantMessage)
			}
		})
	}
}

func TestMatch_UnknownCategory(t *testing.T) {
	matcher, _ := newStubMatcher()
	_, err := matcher.Match(t.Context(), model.MatchQuery{
		Address:  "東京都千代田区紀尾井町1-3",
		Category: model.Category("bogus"),
		Pref:     model.All,
		Limit:    1,
	})
	if err == nil || !strings.Contains(err.Error(), "unknown category") {
		t.Fatalf("err = %v, want unknown category error", err)
	}
}

func TestMatch_DefaultsLimitToOne(t *testing.T) {
	matcher, _ := newStubMatcher()
	resp, err := matcher.Match(t.Context(), model.MatchQuery{
		Address: "千葉県鎌ケ谷市",
		Pref:    model.All,
	})
	if err != nil {
		t.Fatalf("Match: %v", err)
	}
	if resp.ResultInfo.Limit != 1 {
		t.Errorf("ResultInfo.Limit = %d, want 1 (defaulted)", resp.ResultInfo.Limit)
	}
	if resp.Type != "MatchResult" {
		t.Errorf("Type = %q, want MatchResult", resp.Type)
	}
}

func TestMatch_CancelledContext(t *testing.T) {
	matcher, _ := newStubMatcher()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := matcher.Match(ctx, model.MatchQuery{Address: "東京都", Pref: model.All, Limit: 1}); err == nil {
		t.Fatal("Match with cancelled context should fail")
	}
}

// TestGeocode_StubRepo pins Geocode feature output: geometry from the match
// result itself (rsdtdsp) and from the parent lookup (city level).
func TestGeocode_StubRepo(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		category model.Category
		wantJSON string
	}{
		{
			// Coordinates come from the residential row; coordinates_level = match_level.
			name: "geometry from match result", address: "東京都千代田区紀尾井町1-3", category: model.CategoryResidential,
			wantJSON: `[{"type":"Feature","geometry":{"type":"Point","coordinates":[139.736389,35.679108]},"properties":{"matched_address":"東京都千代田区紀尾井町1-3","unmatched_address":null,"score":1,"match_level":"rsdtdsp_rsdt","coordinates_level":"rsdtdsp_rsdt","ids":{"lg_code":"131016","machiaza_id":"0056000","rsdt_addr_flg":"1","blk_id":"001","rsdt_id":"003","rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"東京都","county":null,"city":"千代田区","ward":null,"kyoto_st":null,"oaza_cho":"紀尾井町","chome":null,"koaza":null,"machiaza_dist":null,"blk_num":"1","rsdt_num":"3","rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}}]`,
		},
		{
			// Machiaza-level result whose row has no coordinates: the parent
			// lookup misses the machiaza tier and falls back to the city row,
			// so coordinates_level is city while match_level stays machiaza_detail.
			name: "geometry falls back from machiaza to city", address: "石川県七尾市大田町111", category: model.CategoryBasic,
			wantJSON: `[{"type":"Feature","geometry":{"type":"Point","coordinates":[136.9673,37.04311]},"properties":{"matched_address":"石川県七尾市大田町111","unmatched_address":null,"score":1,"match_level":"machiaza_detail","coordinates_level":"city","ids":{"lg_code":"172022","machiaza_id":"0022145","rsdt_addr_flg":"0","blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"石川県","county":null,"city":"七尾市","ward":null,"kyoto_st":null,"oaza_cho":"大田町","chome":null,"koaza":"111","machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}}]`,
		},
		{
			// City-level result has no coordinates; getCoordinatesFromParent fills them.
			name: "geometry from parent lookup", address: "千葉県鎌ケ谷市", category: model.CategoryBasic,
			wantJSON: `[{"type":"Feature","geometry":{"type":"Point","coordinates":[140.000732,35.776764]},"properties":{"matched_address":"千葉県鎌ケ谷市","unmatched_address":null,"score":0.3,"match_level":"city","coordinates_level":"city","ids":{"lg_code":"122246","machiaza_id":null,"rsdt_addr_flg":null,"blk_id":null,"rsdt_id":null,"rsdt2_id":null,"prc_id":null},"structured_address":{"pref":"千葉県","county":null,"city":"鎌ケ谷市","ward":null,"kyoto_st":null,"oaza_cho":null,"chome":null,"koaza":null,"machiaza_dist":null,"blk_num":null,"rsdt_num":null,"rsdt_num2":null,"prc_num1":null,"prc_num2":null,"prc_num3":null}}}]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matcher, repo := newStubMatcher()
			resp, err := Geocode(t.Context(), matcher, repo, model.MatchQuery{
				Address:  tt.address,
				Category: tt.category,
				Pref:     model.All,
				Limit:    1,
			})
			if err != nil {
				t.Fatalf("Geocode: %v", err)
			}
			gotJSON, err := json.Marshal(resp.Features)
			if err != nil {
				t.Fatalf("marshal features: %v", err)
			}
			var gotAny, wantAny any
			if err := json.Unmarshal(gotJSON, &gotAny); err != nil {
				t.Fatalf("unmarshal got: %v", err)
			}
			if err := json.Unmarshal([]byte(tt.wantJSON), &wantAny); err != nil {
				t.Fatalf("unmarshal want: %v", err)
			}
			if !reflect.DeepEqual(gotAny, wantAny) {
				t.Errorf("features mismatch\ngot:  %s\nwant: %s\nrepo calls:\n  %s",
					gotJSON, tt.wantJSON, strings.Join(repo.calls, "\n  "))
			}
		})
	}
}

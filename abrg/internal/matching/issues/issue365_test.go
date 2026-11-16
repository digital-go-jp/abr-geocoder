package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue365 covers a town name matched fuzzily, followed by a lot number
// with no chome written.
// The lot number is not taken as a chome and stays in unmatched_address.
// When exactly one chome of the town holds the lot, that chome is taken.
// Otherwise no chome is, and a town ranked after it that only looks alike is
// not taken either.
// A leading number that names one of the town's chome is still taken as it,
// as an exact town name does.
// Issue #365: 丁目を書かない住所で番地の数字が丁目に化け、未マッチが空になる
// https://github.com/digital-go-jp/abr-geocoder/issues/365
func TestIssue365(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		}
	}
	noChome := func(address string) normalizeTestCase {
		return normalizeTestCase{
			name:                 "issue365 [" + address + "] lot number is not a chome",
			query:                query(address),
			wantUnmatchedAddress: []string{},
			wantStructured:       map[string]any{FieldChome: nil},
		}
	}

	lotChome := func(address, chome string, unmatched string) normalizeTestCase {
		return normalizeTestCase{
			name:                 "issue365 [" + address + "] chome holding the lot",
			query:                query(address),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantUnmatchedAddress: []string{unmatched},
			wantStructured:       map[string]any{FieldChome: chome},
		}
	}

	tests := []normalizeTestCase{
		// Each lot is in that chome alone among the chomes of the town:
		// lg_code=141321 machiaza_id=0001002, lg_code=431036 machiaza_id=0039002
		// and lg_code=122033 machiaza_id=0004004.
		// 市川町 is registered as 市川, so the 町 left over stays unmatched.
		lotChome("神奈川県川崎市幸区鹿島田1004番地", "2丁目", "1004"),
		lotChome("熊本県熊本市西区二本木26番地", "2丁目", "26"),
		lotChome("千葉県市川市市川町3241番地", "四丁目", "町3241"),
		noChome("熊本県熊本市西区二本木126番地"),
		noChome("熊本県熊本市西区二本木6番地"),
		noChome("東京都新宿区西新宿826番地"),
		noChome("熊本県熊本市西区二本木町126番地"),
		noChome("佐賀県唐津市大字唐津515番地"),
		noChome("東京都千代田区神田旭町14番地"),
		{
			// lg_code=012025 machiaza_id=0102003 (富岡町3丁目) alone holds lot 215
			// among the chomes of 富岡町, and 富浦町 is another town holding it.
			name:                 "issue365 [北海道函館市富岡町２１５番地] lot in one chome",
			query:                query("北海道函館市富岡町２１５番地"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道函館市富岡町3丁目",
			wantUnmatchedAddress: []string{"215"},
			wantStructured:       map[string]any{FieldOazaCho: "富岡町", FieldChome: "3丁目"},
		},
		{
			// lg_code=132047 machiaza_id=0009003 (深大寺3丁目) holds lot 3887.
			name:                 "issue365 [東京都三鷹市深大寺３８８７] lot in one chome",
			query:                query("東京都三鷹市深大寺３８８７"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都三鷹市深大寺3丁目",
			wantUnmatchedAddress: []string{"3887"},
		},
		{
			// Lot 5 is in both 紅雲町一丁目 and 二丁目.
			name:                 "issue365 [群馬県前橋市紅雲町５番地] lot in two chomes",
			query:                query("群馬県前橋市紅雲町５番地"),
			wantMatchLevel:       model.MatchLevelCity,
			wantUnmatchedAddress: []string{"紅雲町5"},
		},
		{
			// The leading 2 names a chome of 西新宿, as in 西新宿2-8-1.
			name:                 "issue365 [東京都新宿区西親宿2-8-1] chome before a hyphen",
			query:                query("東京都新宿区西親宿2-8-1"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都新宿区西新宿2丁目",
			wantUnmatchedAddress: []string{"8-1"},
		},
		{
			// A single number that names a chome is taken as it, as 西新宿2 is.
			name:               "issue365 [東京都新宿区西親宿2] single number naming a chome",
			query:              query("東京都新宿区西親宿2"),
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "東京都新宿区西新宿2丁目",
		},
	}
	runNormalizeTests(t, tests)
}

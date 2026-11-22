package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue365 covers a town name matched fuzzily, followed by a lot number
// with no chome written.
// The lot number is not taken as a chome and stays in unmatched_address.
// No chome is taken, even when exactly one chome of the town holds the lot,
// and a town ranked after it that only looks alike is not taken either.
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

	cityOnly := func(address, unmatched string) normalizeTestCase {
		return normalizeTestCase{
			name:                 "issue365 [" + address + "] no chome taken",
			query:                query(address),
			wantMatchLevel:       model.MatchLevelCity,
			wantUnmatchedAddress: []string{unmatched},
		}
	}

	tests := []normalizeTestCase{
		// Each lot is in one chome alone among the chomes of the town:
		// lg_code=141321 machiaza_id=0001002, lg_code=431036 machiaza_id=0039002
		// and lg_code=122033 machiaza_id=0004004.
		cityOnly("神奈川県川崎市幸区鹿島田1004番地", "鹿島田1004"),
		cityOnly("熊本県熊本市西区二本木26番地", "二本木26"),
		cityOnly("千葉県市川市市川町3241番地", "市川町3241"),
		// lg_code=012025 machiaza_id=0102003 (富岡町3丁目) alone holds lot 215,
		// and 富浦町 is another town holding it.
		cityOnly("北海道函館市富岡町２１５番地", "富岡町215"),
		cityOnly("北海道函館市富岡町２１５－１", "富岡町215-1"),
		// lg_code=132047 machiaza_id=0009003 (深大寺3丁目) holds lot 3887.
		cityOnly("東京都三鷹市深大寺３８８７", "深大寺3887"),
		// Lot 5 is in both 紅雲町一丁目 and 二丁目.
		cityOnly("群馬県前橋市紅雲町５番地", "紅雲町5"),
		// The town is written without its last character 町. Lot 740 is in
		// lg_code=131202 machiaza_id=0045006 (大泉学園町6丁目) alone, and lot 724
		// in lg_code=272051 machiaza_id=0065001 (垂水町1丁目) alone.
		cityOnly("東京都練馬区大泉学園７４０番地", "大泉学園740"),
		cityOnly("東京都練馬区大泉学園７４０－１", "大泉学園740-1"),
		cityOnly("大阪府吹田市大字垂水７２４番地", "大字垂水724"),
		noChome("熊本県熊本市西区二本木126番地"),
		noChome("熊本県熊本市西区二本木6番地"),
		noChome("東京都新宿区西新宿826番地"),
		noChome("熊本県熊本市西区二本木町126番地"),
		noChome("佐賀県唐津市大字唐津515番地"),
		noChome("東京都千代田区神田旭町14番地"),
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

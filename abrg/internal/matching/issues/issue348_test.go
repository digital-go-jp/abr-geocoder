package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue348 covers parcel numbers that are not written in digits alone.
// 甲, 乙 and 丙 are part of the registered parcel number, so ABR keeps them in
// prc_num1 while an address writes them between the town name and the digits.
// https://github.com/digital-go-jp/abr-geocoder/issues/348
func TestIssue348(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			// prc_num1 is 甲402, and the town 白浜町 also holds parcels numbered
			// in digits alone, so the prefixed form has to be preferred.
			name:               "issue348-1 [兵庫県姫路市白浜町甲402番地の106] 甲 prefix",
			query:              query("兵庫県姫路市白浜町甲402番地の106"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "兵庫県姫路市白浜町甲402-106",
			wantStructured: map[string]any{
				FieldPref:    "兵庫県",
				FieldCity:    "姫路市",
				FieldOazaCho: "白浜町",
				FieldPrcNum1: "甲402",
				FieldPrcNum2: "106",
			},
		},
		{
			name:               "issue348-2 [新潟県佐渡市中興乙1443番地4] 乙 prefix",
			query:              query("新潟県佐渡市中興乙1443番地4"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "新潟県佐渡市中興乙1443-4",
			wantStructured: map[string]any{
				FieldPref:    "新潟県",
				FieldCity:    "佐渡市",
				FieldOazaCho: "中興",
				FieldPrcNum1: "乙1443",
				FieldPrcNum2: "4",
			},
		},
		{
			// 甲3114 is registered only with a branch number (甲3114-4 and so
			// on), so an address naming no branch stops at the town.
			name:                 "issue348-3 [香川県観音寺市観音寺町甲3114番地] prefixed number with no branch registered",
			query:                query("香川県観音寺市観音寺町甲3114番地"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県観音寺市観音寺町",
			wantUnmatchedAddress: []string{"甲3114"},
			wantStructured: map[string]any{
				FieldPref:    "香川県",
				FieldCity:    "観音寺市",
				FieldOazaCho: "観音寺町",
			},
		},
		{
			// 字五軒丁 ends with a character that also starts parcel numbers.
			// The town consumed it, so the number stands on its own.
			name:               "issue348-4 [福島県喜多方市熊倉町雄国字五軒丁15-1] prefix character ends the town name",
			query:              query("福島県喜多方市熊倉町雄国字五軒丁15-1"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "福島県喜多方市熊倉町雄国字五軒丁15-1",
			wantStructured: map[string]any{
				FieldPref:    "福島県",
				FieldCity:    "喜多方市",
				FieldOazaCho: "熊倉町雄国",
				FieldKoaza:   "字五軒丁",
				FieldPrcNum1: "15",
				FieldPrcNum2: "1",
			},
		},
		{
			// 紀尾井町 has no parcel numbered 甲1, and the residential 1-3 is a
			// different address, so the input keeps its 甲 unmatched rather than
			// being answered with 紀尾井町1-3.
			name:                 "issue348-5 [東京都千代田区紀尾井町甲1-3] prefix with no parcel behind it",
			query:                query("東京都千代田区紀尾井町甲1-3"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都千代田区紀尾井町",
			wantUnmatchedAddress: []string{"甲1-3"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: "紀尾井町",
			},
		},
		{
			// The prefix belongs to the koaza here, not to the parcel number.
			name:                 "issue348-6 [愛知県名古屋市千種区猪高町大字猪子石字八前甲77番地1] prefix inside the koaza",
			query:                query("愛知県名古屋市千種区猪高町大字猪子石字八前甲77番地1"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛知県名古屋市千種区猪高町大字猪子石字八前",
			wantUnmatchedAddress: []string{"甲77-1"},
			wantStructured: map[string]any{
				FieldPref:    "愛知県",
				FieldCity:    "名古屋市",
				FieldWard:    "千種区",
				FieldOazaCho: "猪高町大字猪子石",
				FieldKoaza:   "字八前",
			},
		},
	})
}

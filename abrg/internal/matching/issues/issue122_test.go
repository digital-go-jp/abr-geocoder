package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue122 tests addresses without oaza but with koaza
// Issue #122: 大字・町なし小字ありのパターン
func TestIssue122(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// status_flg=0 のためコメントアウト (lg_code=014257, machiaza_id=0000109)
		// {
		// 	name: "issue122-1 [北海道空知郡上砂川町緑ケ丘]",
		// 	query: model.MatchQuery{
		// 		Address: "北海道空知郡上砂川町緑ケ丘",
		// 		Category:  model.CategoryAll,
		// 		Pref: "all",
		// 		Limit:   1,
		// 	},
		// 	wantMatchLevel:       model.MatchLevelMachiazaDetail,
		// 	wantMatchedAddress:   "北海道空知郡上砂川町緑が丘",
		// 	wantUnmatchedAddress: nil,
		// 	wantStructured: map[string]any{
		// 		FieldPref:    "北海道",
		// 		FieldCounty:  "空知郡",
		// 		FieldCity:    "上砂川町",
		// 		FieldOazaCho: nil,
		// 		FieldKoaza:   "緑が丘",
		// 	},
		// },
		{
			name: "issue122-2 [宮城県亘理郡亘理町蕨6-1]",
			query: model.MatchQuery{
				Address:  "宮城県亘理郡亘理町蕨6-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "宮城県亘理郡亘理町字蕨6-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "宮城県",
				FieldCounty:       "亘理郡",
				FieldCity:         "亘理町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
				FieldChome:        nil,
				FieldKoaza:        "字蕨",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "6",
				FieldPrcNum2:      "1",
				FieldPrcNum3:      nil,
			},
		},
	})
}

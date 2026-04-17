package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue81 tests that quoted addresses are properly handled
// Issue #81: クォーテーションで囲まれた住所の処理
// https://github.com/digital-go-jp/abr-geocoder/issues/81
//
// CSVファイルなどからの入力でクォーテーションマーク（シングルまたはダブルクォート）で
// 囲まれた住所文字列が正常に処理されること
func TestIssue81(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// ダブルクォートで囲まれた住所
		{
			name: "issue81-1 [\"東京都武蔵野市吉祥寺本町1-1-10\"]",
			query: model.MatchQuery{
				Address:  "\"東京都武蔵野市吉祥寺本町1-1-10\"",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都武蔵野市吉祥寺本町1丁目1-10",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "武蔵野市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "吉祥寺本町",
				FieldChome:        "1丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "10",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// シングルクォートで囲まれた住所
		{
			name: "issue81-2 ['東京都港区虎ノ門3-1-9']",
			query: model.MatchQuery{
				Address:  "'東京都港区虎ノ門3-1-9'",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都港区虎ノ門3丁目1",
			wantUnmatchedAddress: []string{"-9"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "港区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "虎ノ門",
				FieldChome:        "3丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}

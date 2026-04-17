package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue132 tests full-width space normalization in addresses
// Issue #132: 全角空白の正規化
// https://github.com/digital-go-jp/abr-geocoder/issues/132
//
// 問題:
//   - 「東京都千代田区紀尾井町1–3　ＤＩＧＩＴＡＬビル」（全角スペース）が
//     「東京都千代田区紀尾井町1-3 　DIGITALビル」（半角+全角）に変換される
//
// 全角スペースは半角スペースに正規化されるべき
func TestIssue132(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === Issue報告の具体例 ===
		// 全角スペース + 全角英数字
		{
			name: "issue132-1 [東京都千代田区紀尾井町1–3　ＤＩＧＩＴＡＬビル]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1–3　ＤＩＧＩＴＡＬビル",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: []string{"DIGITALビル"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 半角スペース
		{
			name: "issue132-2 [東京都千代田区紀尾井町1-3 DIGITALビル]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3 DIGITALビル",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: []string{"DIGITALビル"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 複数の全角スペース
		{
			name: "issue132-3 [東京都千代田区紀尾井町1-3　　ビル名]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3　　ビル名",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: []string{"ビル名"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// === Issue報告の問題パターン ===
		// 半角スペース + 全角スペースの連続
		// 元のissueでは「1-3 　DIGITALビル」（半角+全角）に変換されていた
		{
			name: "issue132-4 [東京都千代田区紀尾井町1-3 　ビル名]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3 　ビル名",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: []string{"ビル名"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 全角スペース + 半角スペースの連続
		{
			name: "issue132-5 [東京都千代田区紀尾井町1-3　 ビル名]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3　 ビル名",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: []string{"ビル名"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 複数の半角スペース
		{
			name: "issue132-6 [東京都千代田区紀尾井町1-3  ビル名]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3  ビル名",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: []string{"ビル名"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}

package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue187 tests addresses ending with "丁" (cho)
// Issue #187: 「丁」が重複
// https://github.com/digital-go-jp/abr-geocoder/issues/187
//
// 「丁」で終わる町字名を、丁目の処理で重複させないことを確認する。
func TestIssue187(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 長野県小諸市丁 - 「丁」という町字
			name: "issue187-1 [長野県小諸市丁]",
			query: model.MatchQuery{
				Address:  "長野県小諸市丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "長野県小諸市丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       nil,
				FieldCity:         "小諸市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "丁",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 新潟県十日町市丁 - 「丁」という町字
			name: "issue187-2 [新潟県十日町市丁]",
			query: model.MatchQuery{
				Address:  "新潟県十日町市丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "新潟県十日町市丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "新潟県",
				FieldCounty:       nil,
				FieldCity:         "十日町市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "丁",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 茨城県下妻市下妻丁 - 「下妻丁」という町字
			name: "issue187-3 [茨城県下妻市下妻丁]",
			query: model.MatchQuery{
				Address:  "茨城県下妻市下妻丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "茨城県下妻市下妻丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "茨城県",
				FieldCounty:       nil,
				FieldCity:         "下妻市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "下妻丁",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 石川県金沢市十三間町中丁 - 「十三間町中丁」という町字
			// 「中丁」で終わる町字名が正しく認識されることを確認
			name: "issue187-4 [石川県金沢市十三間町中丁15]",
			query: model.MatchQuery{
				Address:  "石川県金沢市十三間町中丁15",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "石川県金沢市十三間町中丁",
			wantUnmatchedAddress: []string{"15"},
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       nil,
				FieldCity:         "金沢市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "十三間町中丁",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}

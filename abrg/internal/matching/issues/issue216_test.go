package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue216 tests masked address normalization
// Issue #216: ファジーモードにおける同定誤り
// https://github.com/digital-go-jp/abr-geocoder/issues/216
//
// マスク文字（●）を含む住所が、誤った都道府県にマッチしないことを確認する。
// ファジーモード（--fuzzy）は未実装。
func TestIssue216(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 「千葉県●橋市」→ 千葉県船橋市にマッチすべき（●を無視して）
			name: "issue216-1 [千葉県●橋市]",
			query: model.MatchQuery{
				Address:  "千葉県●橋市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "千葉県船橋市",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "千葉県",
				FieldCounty:       nil,
				FieldCity:         "船橋市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
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
			// 「沖●県●●市泉崎１丁目」→ マッチしないか沖縄県にマッチすべき
			// マスクが多すぎるためマッチなし（unknown）が正しい
			name: "issue216-2 [沖●県●●市泉崎１丁目]",
			query: model.MatchQuery{
				Address:  "沖●県●●市泉崎１丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelUnknown,
			wantMatchedAddress:   "",
			wantUnmatchedAddress: []string{"沖●県●●市泉崎1丁目"},
			wantStructured: map[string]any{
				FieldPref:         nil,
				FieldCounty:       nil,
				FieldCity:         nil,
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
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

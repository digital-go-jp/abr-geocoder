package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue216 tests masked address normalization
// Issue #216: ファジーモードにおける同定誤り
// https://github.com/digital-go-jp/abr-geocoder/issues/216
//
// Node.js版ではファジーモード（--fuzzy ●）で「千葉県●橋市」が
// 「静岡県島田市千葉」に誤マッチしていた問題。
// Go版ではファジーモードは未実装だが、マスク文字を含む住所が
// 誤った都道府県にマッチしないことを確認する。
func TestIssue216(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 「千葉県●橋市」→ 千葉県船橋市にマッチすべき（●を無視して）
			// Node.js版では静岡県島田市千葉に誤マッチしていた
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
			// Node.js版では滋賀県愛荘町沖1に誤マッチしていた
			// Go版ではマッチなし（unknown）が正しい動作
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

package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue189 tests addresses where 丁目 is a town name itself
// Issue #189: 「丁目」が省略される
// https://github.com/digital-go-jp/abr-geocoder/issues/189
//
// Node.js版では「北海道美唄市六丁目」→「北海道美唄市六」と丁目が省略されていた。
// Go版では丁目が町字名として正しくマッチすることを確認する。
func TestIssue189(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 埼玉県春日部市八丁目 - 「八丁目」が町字名
			// Node.js版では「八」になっていた
			name: "issue189-1 [埼玉県春日部市八丁目]",
			query: model.MatchQuery{
				Address:  "埼玉県春日部市八丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "埼玉県春日部市八丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "埼玉県",
				FieldCounty:       nil,
				FieldCity:         "春日部市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "八丁目",
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
			// 静岡県下田市六丁目 - 「六丁目」が町字名
			name: "issue189-2 [静岡県下田市六丁目]",
			query: model.MatchQuery{
				Address:  "静岡県下田市六丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "静岡県下田市六丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "静岡県",
				FieldCounty:       nil,
				FieldCity:         "下田市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "六丁目",
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
			// 京都府京都市伏見区京町八丁目横町 - 「八丁目」を含む町字名
			// 「八丁目」が省略されず町字名の一部として正しくマッチすることを確認
			name: "issue189-3 [京都府京都市伏見区京町八丁目横町63]",
			query: model.MatchQuery{
				Address:  "京都府京都市伏見区京町八丁目横町63",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "京都府京都市伏見区京町八丁目横町",
			wantUnmatchedAddress: []string{"63"},
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "伏見区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "京町八丁目横町",
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

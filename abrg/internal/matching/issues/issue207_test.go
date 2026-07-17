package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue207 tests koaza patterns with "数字+字"
// Issue #207: 「数字+字」パターンの小字のテスト
func TestIssue207(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// status_flg=0 の小字。#245 で取り込み対象に加わり完全一致で解決する。
			name: "issue207-1a [金沢市田上本町一字]",
			query: model.MatchQuery{
				Address:  "石川県金沢市田上本町一字",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県金沢市田上本町一字",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "石川県",
				FieldCity:    "金沢市",
				FieldOazaCho: "田上本町",
				FieldKoaza:   "一字",
			},
		},
		{
			name: "issue207-1b [石川県金沢市田上本町1丁目]",
			query: model.MatchQuery{
				Address:  "石川県金沢市田上本町1丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県金沢市田上本町1丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       nil,
				FieldCity:         "金沢市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "田上本町",
				FieldChome:        "1丁目",
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

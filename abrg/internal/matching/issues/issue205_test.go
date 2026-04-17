package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue205 tests addresses where "町" appears or disappears
// Issue #205: 特定の地番または住所でのみ「町」が増減する
func TestIssue205(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue205-1 [埼玉県さいたま市見沼区丸ヶ崎町]",
			query: model.MatchQuery{
				Address:  "埼玉県さいたま市見沼区丸ヶ崎町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "埼玉県さいたま市見沼区丸ヶ崎町",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "埼玉県",
				FieldCounty:       nil,
				FieldCity:         "さいたま市",
				FieldWard:         "見沼区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "丸ヶ崎町",
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
			name: "issue205-2 [埼玉県さいたま市見沼区丸ヶ崎]",
			query: model.MatchQuery{
				Address:  "埼玉県さいたま市見沼区丸ヶ崎",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "埼玉県さいたま市見沼区大字丸ヶ崎",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "埼玉県",
				FieldCounty:       nil,
				FieldCity:         "さいたま市",
				FieldWard:         "見沼区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字丸ヶ崎",
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

		// === 新座市野火止パターン ===
		// 「野火止」と「大字野火止」の両方が存在
		{
			name: "issue205-3 [埼玉県新座市野火止1丁目]",
			query: model.MatchQuery{
				Address:  "埼玉県新座市野火止1丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "埼玉県新座市野火止一丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "埼玉県",
				FieldCounty:       nil,
				FieldCity:         "新座市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "野火止",
				FieldChome:        "一丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 大字野火止
		{
			name: "issue205-4 [埼玉県新座市大字野火止]",
			query: model.MatchQuery{
				Address:  "埼玉県新座市大字野火止",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "埼玉県新座市大字野火止",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "埼玉県",
				FieldCounty:       nil,
				FieldCity:         "新座市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字野火止",
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

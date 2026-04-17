package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue123 tests forward matching issue when town names are prefixes of other town names
// Issue #123: 同一市区町村のある町字が別の町字に前方一致するパターン
func TestIssue123(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue123-1 [大分県大分市新川町1丁目]",
			query: model.MatchQuery{
				Address:  "大分県大分市新川町1丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "大分県大分市新川町1丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "大分県",
				FieldCounty:       nil,
				FieldCity:         "大分市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "新川町",
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
		{
			name: "issue123-2 [大分県大分市新川西2-3-1]",
			query: model.MatchQuery{
				Address:  "大分県大分市新川西2-3-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "大分県大分市新川西2丁目",
			wantUnmatchedAddress: []string{"3-1"},
			wantStructured: map[string]any{
				FieldPref:         "大分県",
				FieldCounty:       nil,
				FieldCity:         "大分市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "新川西",
				FieldChome:        "2丁目",
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

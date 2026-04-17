package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue95 tests koaza with numeric-only names
// Issue #95: 小字が数字のみの場合
func TestIssue95(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue95-1 [愛知県豊田市西丹波町三五十]",
			query: model.MatchQuery{
				Address:  "愛知県豊田市西丹波町三五十",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛知県豊田市西丹波町三五十",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛知県",
				FieldCounty:       nil,
				FieldCity:         "豊田市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "西丹波町",
				FieldChome:        nil,
				FieldKoaza:        "三五十",
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

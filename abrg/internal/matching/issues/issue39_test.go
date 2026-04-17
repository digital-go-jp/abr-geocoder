package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue39 tests addresses where chome comes directly under city without oaza
// Issue #39: 町字でいきなり丁目がくる住所への対応
// Note: Similar cases are tested in issue15-4a, issue15-4b (下田市 - 町字に丁目)
func TestIssue39(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue39-1 [茨城県龍ケ崎市3928番地] (category=rsdtdsp)",
			query: model.MatchQuery{
				Address:  "茨城県龍ケ崎市3928番地",
				Category: model.CategoryResidential,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "茨城県龍ケ崎市",
			wantUnmatchedAddress: []string{"3928"},
			wantStructured: map[string]any{
				FieldPref:         "茨城県",
				FieldCounty:       nil,
				FieldCity:         "龍ケ崎市",
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

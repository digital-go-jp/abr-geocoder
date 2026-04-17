package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue90 tests that koaza (小字) is properly matched and returned in results
// Issue90: 小字がジオコーディングの対象になっていない
func TestIssue90(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue90-1 [福島県いわき市山玉町脇川] (category=all)",
			query: model.MatchQuery{
				Address:  "福島県いわき市山玉町脇川",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "福島県いわき市山玉町脇川",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "福島県",
				FieldCounty:       nil,
				FieldCity:         "いわき市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "山玉町",
				FieldChome:        nil,
				FieldKoaza:        "脇川",
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

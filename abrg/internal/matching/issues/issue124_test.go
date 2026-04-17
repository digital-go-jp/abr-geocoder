package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue124 tests half-width katakana normalization
// Issue #124: 半角カタカナの正規化
func TestIssue124(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue124-1 [長野県長野市篠ﾉ井布施高田200]",
			query: model.MatchQuery{
				Address:  "長野県長野市篠ﾉ井布施高田200",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県長野市篠ノ井布施高田200",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       nil,
				FieldCity:         "長野市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "篠ノ井布施高田",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "200",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}

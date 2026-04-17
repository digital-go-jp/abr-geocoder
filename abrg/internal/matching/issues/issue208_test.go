package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue208 tests presence/absence of "ノ" character
// Issue #208: 「ノ」の有無について
func TestIssue208(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue208-1 [京都府京都市南区八条寺内町10]",
			query: model.MatchQuery{
				Address:  "京都府京都市南区八条寺内町10",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市南区八条寺内町10",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "南区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "八条寺内町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "10",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue208-2 [京都府京都市南区八条寺ノ内町10]",
			query: model.MatchQuery{
				Address:  "京都府京都市南区八条寺ノ内町10",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "京都府京都市南区八条寺内町",
			wantUnmatchedAddress: []string{"10"},
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "南区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "八条寺内町",
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

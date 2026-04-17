package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue158 tests koaza omission patterns
// Issue #158: 小字が省略される場合
func TestIssue158(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue158-1 [島根県出雲市大社町杵築東195]",
			query: model.MatchQuery{
				Address:  "島根県出雲市大社町杵築東195",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "島根県出雲市大社町杵築東195",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "島根県",
				FieldCounty:       nil,
				FieldCity:         "出雲市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大社町杵築東",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "195",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue158-2 [長野県長野市南長野県町]",
			query: model.MatchQuery{
				Address:  "長野県長野市南長野県町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "長野県長野市大字南長野県町",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       nil,
				FieldCity:         "長野市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字南長野",
				FieldChome:        nil,
				FieldKoaza:        "県町",
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

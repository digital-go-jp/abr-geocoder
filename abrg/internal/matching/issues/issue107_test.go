package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue107 tests that building names with kanji numerals are correctly included in unmatched address
// Issue #107: 漢数字を含んだ施設名が半角数字に変換されてしまう
func TestIssue107(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue107-1 [東京都港区三田２－２－１８三田マンション９９９]",
			query: model.MatchQuery{
				Address:  "東京都港区三田２－２－１８三田マンション９９９",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都港区三田2丁目2",
			wantUnmatchedAddress: []string{"-18", "三田マンション999"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "港区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三田",
				FieldChome:        "2丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       "2",
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}

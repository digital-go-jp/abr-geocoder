package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue17 tests addresses with building names after spaces
// Issue #17: "other"のスペースが削除されてしまうケースがある
func TestIssue17(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue17-1 [東京都千代田区紀尾井町1-999 ガーデンテラス]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-999 ガーデンテラス",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都千代田区紀尾井町1",
			wantUnmatchedAddress: []string{"-999", "ガーデンテラス"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紀尾井町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}

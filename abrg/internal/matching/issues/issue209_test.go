package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue209 tests addresses where kanji numerals in town names match the following numbers
// Issue #209: 町字の漢数字と同じ数字が消える
func TestIssue209(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue209-1 [東京都千代田区一番町10-1]",
			query: model.MatchQuery{
				Address:  "東京都千代田区一番町10-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "東京都千代田区一番町10-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "千代田区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "一番町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "10",
				FieldPrcNum2:      "1",
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue209-2 [京都府京都市中京区三条町324-1]",
			query: model.MatchQuery{
				Address:  "京都府京都市中京区三条町324-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市中京区三条町324-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "中京区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三条町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "324",
				FieldPrcNum2:      "1",
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue209-3 [京都府京都市東山区七軒町7-1]",
			query: model.MatchQuery{
				Address:  "京都府京都市東山区七軒町7-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市東山区七軒町7-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "東山区",
				FieldMachiazaDist: "三条通",
				FieldKyotoSt:      nil,
				FieldOazaCho:      "七軒町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "7",
				FieldPrcNum2:      "1",
				FieldPrcNum3:      nil,
			},
		},
	})
}

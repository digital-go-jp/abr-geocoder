package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue130 tests parcel number matching
// Issue #130: 地番マッチング
func TestIssue130(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue130-1 [春日部市大字八丁目353番地]",
			query: model.MatchQuery{
				Address:  "埼玉県春日部市大字八丁目３５３番地",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "埼玉県春日部市八丁目353",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "埼玉県",
				FieldCounty:       nil,
				FieldCity:         "春日部市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "八丁目",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "353",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue130-2 [春日部市大字八丁目353-1番地 (353-1は存在しない)]",
			query: model.MatchQuery{
				Address:  "埼玉県春日部市大字八丁目３５３番地１",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "埼玉県春日部市八丁目",
			wantUnmatchedAddress: []string{"353-1"},
			wantStructured: map[string]any{
				FieldPref:         "埼玉県",
				FieldCounty:       nil,
				FieldCity:         "春日部市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "八丁目",
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

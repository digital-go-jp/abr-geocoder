package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue134 tests zodiac sign normalization
// Issue #134: 十二支が正しくマッチングしない
func TestIssue134(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 巳と己は別の文字のため fuzzy match せず、下町止まりで巳はunmatchedに残るべき
			name: "issue134-1a [石川県七尾市下町巳]",
			query: model.MatchQuery{
				Address:  "石川県七尾市下町巳",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "石川県七尾市下町",
			wantUnmatchedAddress: []string{"巳"},
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       nil,
				FieldCity:         "七尾市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "下町",
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
		{
			name: "issue134-1b [石川県七尾市下町己]",
			query: model.MatchQuery{
				Address:  "石川県七尾市下町己",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県七尾市下町己",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       nil,
				FieldCity:         "七尾市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "下町",
				FieldChome:        nil,
				FieldKoaza:        "己",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 戌と戊は別の文字のため fuzzy match せず、下町止まりで戌はunmatchedに残るべき
			name: "issue134-2a [石川県七尾市下町戌]",
			query: model.MatchQuery{
				Address:  "石川県七尾市下町戌",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "石川県七尾市下町",
			wantUnmatchedAddress: []string{"戌"},
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       nil,
				FieldCity:         "七尾市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "下町",
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
		{
			name: "issue134-2b [石川県七尾市下町戊]",
			query: model.MatchQuery{
				Address:  "石川県七尾市下町戊",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県七尾市下町戊",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       nil,
				FieldCity:         "七尾市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "下町",
				FieldChome:        nil,
				FieldKoaza:        "戊",
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

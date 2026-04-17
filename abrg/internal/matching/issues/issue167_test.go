package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue167 tests handling of kanji variant characters in county names
// Issue #167: 長野県植科郡の植と埴（異体字）
// https://github.com/digital-go-jp/abr-geocoder/issues/167
//
// The official county name is 埴科郡 (Hanishina County), but some systems
// use the variant character 植 instead of 埴. The normalizer should accept
// both inputs and normalize to the correct 埴科郡.
func TestIssue167(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// 正しい漢字「埴科郡」での入力
		{
			name: "issue167-1a [長野県埴科郡坂城町坂城6227] correct kanji 埴",
			query: model.MatchQuery{
				Address:  "長野県埴科郡坂城町坂城6227",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県埴科郡坂城町大字坂城6227",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       "埴科郡",
				FieldCity:         "坂城町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字坂城",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "6227",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 異体字「植科郡」での入力（植と埴は異体字）
		{
			name: "issue167-1b [長野県植科郡坂城町坂城6227] variant kanji 植 -> 埴",
			query: model.MatchQuery{
				Address:  "長野県植科郡坂城町坂城6227",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県埴科郡坂城町大字坂城6227",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       "埴科郡",
				FieldCity:         "坂城町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字坂城",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "6227",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 南条地区
		{
			name: "issue167-2a [長野県埴科郡坂城町南条2036] correct kanji",
			query: model.MatchQuery{
				Address:  "長野県埴科郡坂城町南条2036",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県埴科郡坂城町大字南条2036",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       "埴科郡",
				FieldCity:         "坂城町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字南条",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "2036",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue167-2b [長野県植科郡坂城町南条2036] variant kanji",
			query: model.MatchQuery{
				Address:  "長野県植科郡坂城町南条2036",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県埴科郡坂城町大字南条2036",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       "埴科郡",
				FieldCity:         "坂城町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字南条",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "2036",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 上平地区
		{
			name: "issue167-3a [長野県埴科郡坂城町上平1428-1] correct kanji",
			query: model.MatchQuery{
				Address:  "長野県埴科郡坂城町上平1428-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県埴科郡坂城町大字上平1428-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       "埴科郡",
				FieldCity:         "坂城町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字上平",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "1428",
				FieldPrcNum2:      "1",
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue167-3b [長野県植科郡坂城町上平1428-1] variant kanji",
			query: model.MatchQuery{
				Address:  "長野県植科郡坂城町上平1428-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県埴科郡坂城町大字上平1428-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "長野県",
				FieldCounty:       "埴科郡",
				FieldCity:         "坂城町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字上平",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "1428",
				FieldPrcNum2:      "1",
				FieldPrcNum3:      nil,
			},
		},
	})
}

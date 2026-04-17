package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue197 tests addresses where 町 might be duplicated
// Issue #197: 「町」が重複
// https://github.com/digital-go-jp/abr-geocoder/issues/197
//
// Node.js版では「山川町宗田」→「山川町町宗田」と町が重複していた。
// Go版では重複が発生しないことを確認する。
func TestIssue197(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 徳島県吉野川市山川町宗田 - 山川町が町字名
			// Node.js版では「山川町町宗田」になっていた
			name: "issue197-1 [徳島県吉野川市山川町宗田]",
			query: model.MatchQuery{
				Address:  "徳島県吉野川市山川町宗田",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "徳島県吉野川市山川町宗田",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "徳島県",
				FieldCounty:       nil,
				FieldCity:         "吉野川市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "山川町宗田",
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
			// 石川県羽咋郡志賀町町居ニ - 「町居」が大字、「ニ」が小字
			// 「町」が重複せず正しく分離されることを確認
			name: "issue197-2 [石川県羽咋郡志賀町町居ニ]",
			query: model.MatchQuery{
				Address:  "石川県羽咋郡志賀町町居ニ",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県羽咋郡志賀町町居ニ",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       "羽咋郡",
				FieldCity:         "志賀町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "町居",
				FieldChome:        nil,
				FieldKoaza:        "ニ",
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

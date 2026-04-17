package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue1 tests prefecture name omission when prefecture and city names are the same
// Issue #1: 都道府県名の省略時の都道府県名と市区町村名が同じ場合
func TestIssue1(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// 市のみで都道府県名省略
		{
			name: "issue1-1 [青森市]",
			query: model.MatchQuery{
				Address:  "青森市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "青森県青森市",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "青森県",
				FieldCounty:       nil,
				FieldCity:         "青森市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      nil,
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
		// 住居番号完全一致で都道府県省略
		{
			name: "issue1-2 [山形市旅篭町二丁目3番25号]",
			query: model.MatchQuery{
				Address:  "山形市旅篭町二丁目3番25号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "山形県山形市旅篭町二丁目3-25",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "山形県",
				FieldCounty:       nil,
				FieldCity:         "山形市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "旅篭町",
				FieldChome:        "二丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       "3",
				FieldRsdtNum:      "25",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
	})
}

package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue219 tests town names with "数字+番町" and "数字+条" patterns
// Issue #219: 「数字+番町」「数字+条」パターンの町名のテスト
func TestIssue219(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue219-1a [名古屋市中川区十一番町二丁目]",
			query: model.MatchQuery{
				Address:  "愛知県名古屋市中川区十一番町二丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛知県名古屋市中川区十一番町二丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛知県",
				FieldCounty:       nil,
				FieldCity:         "名古屋市",
				FieldWard:         "中川区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "十一番町",
				FieldChome:        "二丁目",
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
			name: "issue219-1b [岡山県笠岡市十一番町]",
			query: model.MatchQuery{
				Address:  "岡山県笠岡市十一番町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "岡山県笠岡市十一番町",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岡山県",
				FieldCounty:       nil,
				FieldCity:         "笠岡市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "十一番町",
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
			// 「朝日五条」は oaza_cho="朝日" + koaza="五条" に分解される（Issue#219 の検証目的）。
			// 朝日/五条には地番データが存在するため、末尾の "1" は prc_num1 として解釈される。
			name: "issue219-2 [愛知県清須市朝日五条]",
			query: model.MatchQuery{
				Address:  "愛知県清須市朝日五条1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "愛知県清須市朝日五条1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛知県",
				FieldCounty:       nil,
				FieldCity:         "清須市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "朝日",
				FieldChome:        nil,
				FieldKoaza:        "五条",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "1",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue219-3 [愛知県春日井市八事町二丁目]",
			query: model.MatchQuery{
				Address:  "愛知県春日井市八事町二丁目1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛知県春日井市八事町2丁目",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:         "愛知県",
				FieldCounty:       nil,
				FieldCity:         "春日井市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "八事町",
				FieldChome:        "2丁目",
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

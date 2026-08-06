package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue234 tests address normalization without sub-town level data (category=basic)
// Issue #234: 町字未満のデータを読み込まない場合の正規化の不具合
// https://github.com/digital-go-jp/abr-geocoder/issues/234
//
// 問題:
// - 「東京都港区虎の門１－２３－１ 虎ノ門ヒルズ森タワー ２２階」→「東京都港区虎ノ門2丁目」（誤り、1丁目が正解）
// - 「東京都港区芝公園４－２－８」→「東京都港区芝公園2丁目」（誤り、4丁目が正解）
// - 建物名を削除すると結果が変わる
//
// このissueの意図: category=basic（町字未満のデータなし）でも正しい丁目にマッチすべき
func TestIssue234(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// 建物名あり: 「虎の門」(ひらがな)→「虎ノ門」(カタカナ)に正規化される
		{
			name: "issue234-1 [東京都港区虎の門１－２３－１ 虎ノ門ヒルズ森タワー ２２階]",
			query: model.MatchQuery{
				Address:  "東京都港区虎の門１－２３－１ 虎ノ門ヒルズ森タワー ２２階",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都港区虎ノ門1丁目",
			wantUnmatchedAddress: []string{"23-1", "虎ノ門ヒルズ森タワー", "22階"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "港区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "虎ノ門",
				FieldChome:        "1丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 建物名なし: issueでは建物名を削除すると結果が変わる問題も報告されていた
		{
			name: "issue234-2 [東京都港区虎ノ門１－２３－１]",
			query: model.MatchQuery{
				Address:  "東京都港区虎ノ門１－２３－１",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都港区虎ノ門1丁目",
			wantUnmatchedAddress: []string{"23-1"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "港区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "虎ノ門",
				FieldChome:        "1丁目",
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
			name: "issue234-3 [東京都港区芝公園４－２－８]",
			query: model.MatchQuery{
				Address:  "東京都港区芝公園４－２－８",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都港区芝公園4丁目",
			wantUnmatchedAddress: []string{"2-8"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "港区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "芝公園",
				FieldChome:        "4丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 番-号形式: 「虎の門」(ひらがな)→「虎ノ門」(カタカナ)に正規化
		{
			name: "issue234-4 [東京都港区虎の門1丁目23番1号]",
			query: model.MatchQuery{
				Address:  "東京都港区虎の門1丁目23番1号",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都港区虎ノ門1丁目",
			wantUnmatchedAddress: []string{"23-1"},
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "港区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "虎ノ門",
				FieldChome:        "1丁目",
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

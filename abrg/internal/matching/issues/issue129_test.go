package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue129 tests spacing before building/facility names in output
// Issue #129: `output`の`other`の前のスペースが省略される場合がある
// https://github.com/digital-go-jp/abr-geocoder/issues/129
//
// 問題:
// - 「兵庫県三田市三輪2-1-1三田市役所」→「兵庫県三田市三輪二丁目1-1 三田市役所」（スペースあり）
// - 「兵庫県三田市三輪2-1三田市役所」→「兵庫県三田市三輪二丁目1三田市役所」（スペースなし）
//
// 住居番号の後に建物名が続く場合、スペースが正しく挿入されるべき
func TestIssue129(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === Issue報告の具体例 ===
		// 住居番号までマッチ + 建物名（スペースあり）
		{
			name: "issue129-1 [兵庫県三田市三輪2-1-1三田市役所]",
			query: model.MatchQuery{
				Address:  "兵庫県三田市三輪2-1-1三田市役所",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "兵庫県三田市三輪2丁目1-1",
			wantUnmatchedAddress: []string{"三田市役所"},
			wantStructured: map[string]any{
				FieldPref:         "兵庫県",
				FieldCounty:       nil,
				FieldCity:         "三田市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三輪",
				FieldChome:        "2丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "1",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 街区までマッチ + 建物名（スペースが省略される問題）
		{
			name: "issue129-2 [兵庫県三田市三輪2-1三田市役所]",
			query: model.MatchQuery{
				Address:  "兵庫県三田市三輪2-1三田市役所",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "兵庫県三田市三輪2丁目1",
			wantUnmatchedAddress: []string{"三田市役所"},
			wantStructured: map[string]any{
				FieldPref:         "兵庫県",
				FieldCounty:       nil,
				FieldCity:         "三田市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三輪",
				FieldChome:        "2丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// === 追加パターン（千代田区紀尾井町）===
		// 住居表示（番号まで完全マッチ）+ 建物名
		{
			name: "issue129-3 [東京都千代田区紀尾井町1-3デジタルビル]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3デジタルビル",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: []string{"デジタルビル"},
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
				FieldRsdtNum:      "3",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 住居表示（街区まで）+ 建物名
		{
			name: "issue129-4 [東京都千代田区紀尾井町1デジタルビル]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1デジタルビル",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialBlock,
			wantMatchedAddress:   "東京都千代田区紀尾井町1",
			wantUnmatchedAddress: []string{"デジタルビル"},
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

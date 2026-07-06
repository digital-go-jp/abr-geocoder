package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue243 verifies city boundary detection for cities whose name contains a
// mid-string 市/町/村 marker.
// Issue #243: 市区町村名の途中に「市/町/村」を含む市が誤切断される
//
// 問題:
//   - FindCityBoundary が名称の途中に現れる最初の 市/町/村 で境界を切っていた
//   - 「千葉県市川市」→千葉県旭市、「東京都町田市」「東京都東村山市」→都道府県止まり
//
// 解決:
//   - cache_city 全市名との最長一致で境界を決定 (util.CityBoundary)
//   - 末尾が市の大字 (五日市/八日市/今市) は市名集合に無いため吸収しない
func TestIssue243(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue243-1 [千葉県市川市] mid-string 市",
			query: model.MatchQuery{
				Address:  "千葉県市川市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "千葉県市川市",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "千葉県",
				FieldCity:    "市川市",
				FieldWard:    nil,
				FieldOazaCho: nil,
			},
		},
		{
			name: "issue243-2 [東京都町田市] mid-string 町",
			query: model.MatchQuery{
				Address:  "東京都町田市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "東京都町田市",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref: "東京都",
				FieldCity: "町田市",
				FieldWard: nil,
			},
		},
		{
			name: "issue243-3 [東京都東村山市] mid-string 村",
			query: model.MatchQuery{
				Address:  "東京都東村山市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "東京都東村山市",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref: "東京都",
				FieldCity: "東村山市",
				FieldWard: nil,
			},
		},
		{
			// 境界が正しくなることで奥の住居表示まで解決できること
			name: "issue243-4 [東京都町田市中町1丁目1番1号] resolves to residential",
			query: model.MatchQuery{
				Address:  "東京都町田市中町1丁目1番1号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都町田市中町1丁目1-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "町田市",
				FieldOazaCho: "中町",
				FieldChome:   "1丁目",
				FieldBlkNum:  "1",
				FieldRsdtNum: "1",
			},
		},
		{
			// 回帰ガード: 末尾が市の大字を市名に吸収しない
			name: "issue243-5 [東京都あきる野市五日市] oaza ending in 市 not absorbed",
			query: model.MatchQuery{
				Address:  "東京都あきる野市五日市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "東京都あきる野市五日市",
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "あきる野市",
				FieldOazaCho: "五日市",
			},
		},
	})
}

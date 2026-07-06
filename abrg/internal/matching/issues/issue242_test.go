package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue242 verifies prefecture-scoped city fallback for same-named cities.
// Issue #242: 都道府県を明示しても別県の同名市へ誤マッチする
//
// 問題:
//   - 「広島県府中市…」が東京都府中市 (lg=132063) にマッチしていた
//   - city fallback (FindCityByAddress) が normalized_address のみで LIMIT 1 し、
//     pref_code で絞っていなかったため、同名市 (府中市 = 東京都/広島県) で
//     lg_code 先頭行が返っていた
//
// 解決:
//   - 検出済み pref_code を city fallback に渡し AND pref_code = ? で絞る
func TestIssue242(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue242-1 [広島県府中市上下町甲148番地] prefecture-scoped city",
			query: model.MatchQuery{
				Address:  "広島県府中市上下町甲148番地",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "広島県府中市",
			wantUnmatchedAddress: []string{"上下町甲148"},
			wantStructured: map[string]any{
				FieldPref:    "広島県",
				FieldCity:    "府中市",
				FieldWard:    nil,
				FieldOazaCho: nil,
			},
		},
		{
			// 対照: 同名の東京都府中市は引き続き正しく解決すること
			name: "issue242-2 [東京都府中市宮西町2丁目] same name, other prefecture",
			query: model.MatchQuery{
				Address:  "東京都府中市宮西町2丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都府中市宮西町2丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "府中市",
				FieldOazaCho: "宮西町",
				FieldChome:   "2丁目",
			},
		},
	})
}

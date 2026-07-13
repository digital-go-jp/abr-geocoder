package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue245 verifies that current towns whose ABR status_flg=0
// (自治体確認待ち) are imported and resolve by exact match.
// Issue #245: 現行町字が status_flg=0（自治体確認待ち）で取り込み対象外
//
// 問題:
//   - abrdb の取り込みフィルタ config_default.yaml が status_flg IN ("1","2") で、
//     status_flg=0 の現行丁目町字（西新宿一/六丁目、熊谷市の丁目 等）が
//     cache_machiaza に入らず city 止まりになっていた。
//
// 解決:
//   - フィルタを status_flg IN ("0","1","2") に変更し status_flg=0 も取り込む。
//     現行町字が完全一致（丁目は漢数字/算用数字の正規化一致）で machiaza_detail
//     まで解決する。
//
// 注: status_flg=0 を含む cache を要する（CACHE_PATH）。
func TestIssue245(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 西新宿一丁目は漢数字表記で status_flg=0。従来は city 止まり。
			name: "issue245-1 [東京都新宿区西新宿一丁目] status_flg=0 chome resolves",
			query: model.MatchQuery{
				Address:  "東京都新宿区西新宿一丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都新宿区西新宿一丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "新宿区",
				FieldOazaCho: "西新宿",
				FieldChome:   "一丁目",
			},
		},
		{
			name: "issue245-2 [東京都新宿区西新宿六丁目] status_flg=0 chome resolves",
			query: model.MatchQuery{
				Address:  "東京都新宿区西新宿六丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都新宿区西新宿六丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "新宿区",
				FieldOazaCho: "西新宿",
				FieldChome:   "六丁目",
			},
		},
		{
			// 算用数字入力でも正規化で漢数字丁目に一致する。
			name: "issue245-3 [東京都新宿区西新宿1丁目] arabic numeral normalizes to kanji chome",
			query: model.MatchQuery{
				Address:  "東京都新宿区西新宿1丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都新宿区西新宿一丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "新宿区",
				FieldOazaCho: "西新宿",
				FieldChome:   "一丁目",
			},
		},
		{
			// 熊谷市は丁目町字が全件 status_flg=0。従来は市内の丁目住所が全件 city 止まり。
			name: "issue245-4 [埼玉県熊谷市本町1丁目] all-status_flg=0 city resolves",
			query: model.MatchQuery{
				Address:  "埼玉県熊谷市本町1丁目",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "埼玉県熊谷市本町一丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "埼玉県",
				FieldCity:    "熊谷市",
				FieldOazaCho: "本町",
				FieldChome:   "一丁目",
			},
		},
	})
}

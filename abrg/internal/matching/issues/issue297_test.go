package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue297 tests ward-only address resolution when prefecture and city are omitted.
// Issue #297: 都道府県と市名を省略した区名のみの住所が完全マッチしない
// https://github.com/digital-go-jp/abr-geocoder/issues/297
//
// 問題:
//   - 「中区本町1-1」のように都道府県と市名を省略し、区名のみで入力するとscore=-1で完全マッチ失敗
//   - 照合列 normalized_address は「横浜市中区本町」のようにcity+ward形式だが、
//     ユーザー入力は「中区本町」でward+oazaのみのため一致しない
//   - cityPrefixMapは複数県にまたがる区名を除外するため、都道府県推定もできない
//
// 解決:
// - Ward展開フォールバック: 区名のみの入力を検出し、全候補市名を前置して再検索
// - 「中区」なら cache_city にある中区すべてを前置して引き直す
func TestIssue297(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === Ward展開フォールバック ===
		{
			// 中区は複数の市にあり区名だけでは市が定まらないが、
			// 本町1丁目を持つ中区は横浜市だけなので町字で定まる
			name: "issue297-1 [中区本町1-1] ward-only with ambiguous ward",
			query: model.MatchQuery{
				Address:  "中区本町1-1",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "神奈川県横浜市中区本町1丁目",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "神奈川県",
				FieldCity:    "横浜市",
				FieldWard:    "中区",
				FieldOazaCho: "本町",
				FieldChome:   "1丁目",
			},
		},

		{
			// 南区も同じく複数の市にある。白妙町を持つ南区は横浜市だけ
			name: "issue297-2 [南区白妙町1-1] ward-only",
			query: model.MatchQuery{
				Address:  "南区白妙町1-1",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "神奈川県横浜市南区白妙町1丁目",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "神奈川県",
				FieldCity:    "横浜市",
				FieldWard:    "南区",
				FieldOazaCho: "白妙町",
				FieldChome:   "1丁目",
			},
		},

		// === 既存フローへの regression テスト ===
		// 都道府県+市+区がすべて指定されている場合は既存フローで処理
		{
			// 本町1丁目が実在するため「1」を丁目として正しく解析
			name: "issue297-3 [横浜市中区本町1-1] city+ward should still work",
			query: model.MatchQuery{
				Address:  "横浜市中区本町1-1",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "神奈川県横浜市中区本町1丁目",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "神奈川県",
				FieldCity:    "横浜市",
				FieldWard:    "中区",
				FieldOazaCho: "本町",
				FieldChome:   "1丁目",
			},
		},
		{
			// 本町1丁目が実在するため「1」を丁目として正しく解析
			name: "issue297-4 [神奈川県横浜市中区本町1-1] full address",
			query: model.MatchQuery{
				Address:  "神奈川県横浜市中区本町1-1",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "神奈川県横浜市中区本町1丁目",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "神奈川県",
				FieldCity:    "横浜市",
				FieldWard:    "中区",
				FieldOazaCho: "本町",
				FieldChome:   "1丁目",
			},
		},

		// 東京特別区は ward=NULL なので wardCandidates に含まれず既存フローで処理
		{
			name: "issue297-5 [中央区銀座1-1] Tokyo special ward unchanged",
			query: model.MatchQuery{
				Address:  "中央区銀座1-1",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都中央区銀座1丁目",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "中央区",
				FieldWard:    nil,
				FieldOazaCho: "銀座",
				FieldChome:   "1丁目",
			},
		},
	})
}

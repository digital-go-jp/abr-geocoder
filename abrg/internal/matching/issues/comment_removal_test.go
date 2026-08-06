package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestCommentRemoval tests that comments are removed from UnmatchedAddress.
// 入力アドレスにコメント（/* ... */ や //）が含まれている場合、
// UnmatchedAddressにコメントが残らないことを確認する。
func TestCommentRemoval(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// 高精度マッチでコメントが除去されることを確認
		{
			name: "comment-removal-1 [コメント付き住所 - 高精度マッチ]",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀尾井町1-3 /* test comment */",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都千代田区紀尾井町",
			wantUnmatchedAddress: []string{"1-3"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: "紀尾井町",
			},
		},
		// 行コメント（//）も除去されることを確認
		{
			name: "comment-removal-2 [行コメント付き住所]",
			query: model.MatchQuery{
				Address:  "東京都新宿区西新宿2-8-1 都庁 // line comment",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都新宿区西新宿2丁目",
			wantUnmatchedAddress: []string{"8-1", "都庁"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "新宿区",
				FieldOazaCho: "西新宿",
				FieldChome:   "2丁目",
			},
		},
		// コメント付き - Levenshtein fallbackケース（低精度マッチ）
		// コメントは除去され、未マッチには住所と施設名だけが残る
		{
			name: "comment-removal-3 [Levenshtein fallback - コメント除去]",
			query: model.MatchQuery{
				Address:  "岩手県九戸郡軽米町大字晴山23-35 晴山小学校 /* B103250100039 141.379464 40.322527 */",
				Category: model.CategoryBasic,
				Pref:     "03", // 岩手県
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelCity,
			wantMatchedAddress: "岩手県九戸郡軽米町",
			// コメント部分（/*, B103250100039, 141.379464, 40.322527, */）が含まれないこと
			wantUnmatchedAddress: []string{"大字晴山23-35", "晴山小学校"},
			wantStructured: map[string]any{
				FieldPref:   "岩手県",
				FieldCounty: "九戸郡",
				FieldCity:   "軽米町",
			},
		},
	})
}

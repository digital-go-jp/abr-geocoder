package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue246 verifies that a same-length single-character substitution in the
// town name still resolves the residential/parcel detail.
// Issue #246: 町字の先頭以外の1文字が外字・誤字で完全一致しない住所が曖昧マッチで住居表示・地番まで到達しない
//
// 問題:
//   - 町字1文字が外字/誤字だと levenshtein 曖昧マッチで町字には到達するが、
//     normalizeAll が usedLevenshteinFallback=true のとき residential/parcel の
//     2段マッチを丸ごとスキップし machiaza 止まりになっていた。
//
// 解決:
//   - 曖昧マッチが同字数・置換のみ(挿入/削除なし)のときは、番地が完全一致時と
//     同位置なので2段マッチを継続する (fuzzyMatchAllowsTwoStage)。
//   - 挿入/削除や数字の地名吸収(境界ずれ)はスキップする。
func TestIssue246(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 町字2文字目を外字(●)に置換 → 紀尾井町 と同字数1文字置換。
			name: "issue246-1 [東京都千代田区紀●井町1-3] town substitution reaches residential",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀●井町1-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: "紀尾井町",
				FieldBlkNum:  "1",
				FieldRsdtNum: "3",
			},
		},
		{
			// 実在別字(緒)への置換でも同字数なので同様に到達。
			name: "issue246-2 [東京都千代田区紀緒井町1-3] real-kanji substitution",
			query: model.MatchQuery{
				Address:  "東京都千代田区紀緒井町1-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: "紀尾井町",
				FieldBlkNum:  "1",
				FieldRsdtNum: "3",
			},
		},
		{
			// 市区町村名側の1文字置換・町字は完全一致でも到達する。
			name: "issue246-3 [東京都千●田区紀尾井町1-3] city substitution, exact town",
			query: model.MatchQuery{
				Address:  "東京都千●田区紀尾井町1-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "東京都千代田区紀尾井町1-3",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: "紀尾井町",
				FieldBlkNum:  "1",
				FieldRsdtNum: "3",
			},
		},
		{
			// 回帰ガード: 数字が小字名に食い込む境界ずれ(福室字久保野二番)は継続せず machiaza 止まり。
			name: "issue246-4 [宮城県仙台市宮城野区福室字久保野2-5] boundary shift stays machiaza",
			query: model.MatchQuery{
				Address:  "宮城県仙台市宮城野区福室字久保野2-5",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県仙台市宮城野区福室字久保野二番",
			wantUnmatchedAddress: []string{"2-5"},
			wantStructured: map[string]any{
				FieldPref:    "宮城県",
				FieldCity:    "仙台市",
				FieldWard:    "宮城野区",
				FieldOazaCho: "福室",
				FieldKoaza:   "字久保野二番",
			},
		},
		{
			// 回帰ガード: ノ 挿入(字数変化)は継続対象外で machiaza 止まり。
			name: "issue246-5 [京都府京都市南区八条寺ノ内町10] insertion stays machiaza",
			query: model.MatchQuery{
				Address:  "京都府京都市南区八条寺ノ内町10",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "京都府京都市南区八条寺内町",
			wantUnmatchedAddress: []string{"10"},
			wantStructured: map[string]any{
				FieldPref:    "京都府",
				FieldCity:    "京都市",
				FieldWard:    "南区",
				FieldOazaCho: "八条寺内町",
			},
		},
		{
			// 回帰ガード: 町字先頭1文字差は棄却され city 止まり。
			name: "issue246-6 [東京都千代田区●尾井町1-3] first-char difference rejected",
			query: model.MatchQuery{
				Address:  "東京都千代田区●尾井町1-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "東京都千代田区",
			wantUnmatchedAddress: []string{"●尾井町1-3"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "千代田区",
				FieldOazaCho: nil,
			},
		},
		{
			// 回帰ガード: 同一市内に2文字目だけ違う実在町字(中村町/中里町)がある場合でも、
			// 正しく入力すれば完全一致が優先され、互いに取り違えない(曖昧継続は非該当)。
			name: "issue246-7 [三重県四日市市中村町1] real town with confusable sibling",
			query: model.MatchQuery{
				Address:  "三重県四日市市中村町1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "三重県四日市市中村町",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "三重県",
				FieldCity:    "四日市市",
				FieldOazaCho: "中村町",
			},
		},
		{
			name: "issue246-8 [三重県四日市市中里町1] confusable sibling resolves to itself",
			query: model.MatchQuery{
				Address:  "三重県四日市市中里町1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "三重県四日市市中里町",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "三重県",
				FieldCity:    "四日市市",
				FieldOazaCho: "中里町",
			},
		},
	})
}

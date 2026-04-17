package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue239 tests Levenshtein fuzzy match city fallback for Unicode addresses
// Issue #373: Levenshtein fuzzy match city fallback broken
//
// 問題:
// - 広島県福山市港町 が「旭町」(score 0.6) を返す
// - DuckDB editdist3 はバイトベースだが、閾値/スコアがルーン数で計算されていた
// - city fallback が cache_machiaza を検索しており、市名のみでは editdist3 閾値を超えてマッチ不可
// - fallback 失敗時に誤マッチをそのまま返していた
//
// 解決:
// - A. DB閾値をバイトベースに統一 (EditDistanceDivisor 2→3, len([]rune)→len(bytes))
// - B. Go側で rune Levenshtein を計算して正確なスコアリング
// - C. city fallback で cache_city を直接検索
// - D. town name mismatch かつ fallback 失敗時は誤マッチを破棄
func TestIssue239(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === メインの問題ケース ===
		// 広島県福山市港町: 港町はDBに存在しないが、旭町を返すのではなく市レベルにフォールバックすべき
		{
			name: "issue239-1 [広島県福山市港町] city fallback",
			query: model.MatchQuery{
				Address:  "広島県福山市港町",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "広島県福山市",
			wantUnmatchedAddress: []string{"港町"},
			wantStructured: map[string]any{
				FieldPref:         "広島県",
				FieldCounty:       nil,
				FieldCity:         "福山市",
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

		// === 正常マッチの確認（福山市の実在する町名） ===
		// 旭町は実在するので正常にマッチすべき
		{
			name: "issue239-2 [広島県福山市旭町] exact match",
			query: model.MatchQuery{
				Address:  "広島県福山市旭町",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "広島県福山市旭町",
			wantStructured: map[string]any{
				FieldPref:         "広島県",
				FieldCounty:       nil,
				FieldCity:         "福山市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "旭町",
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

		// === issue236 からの回帰テスト ===
		// 烏ケ辻のtown name mismatch → city fallback のケースが引き続き動作すること
		{
			name: "issue239-3 [大阪府大阪市天王寺区烏ヶ辻町74番地] town mismatch → city fallback",
			query: model.MatchQuery{
				Address:  "大阪府大阪市天王寺区烏ヶ辻町74番地",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "大阪府大阪市天王寺区",
			wantUnmatchedAddress: []string{"烏ヶ辻町74"},
			wantStructured: map[string]any{
				FieldPref:         "大阪府",
				FieldCounty:       nil,
				FieldCity:         "大阪市",
				FieldWard:         "天王寺区",
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

		// === 霞町は丁目付きでのみDB上に存在(霞町1@〜4@)、丁目なしではマッチしない ===
		// 港町と同様に町字単独ではマッチしないため city fallback
		{
			name: "issue239-4 [広島県福山市霞町] city fallback",
			query: model.MatchQuery{
				Address:  "広島県福山市霞町",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "広島県福山市",
			wantUnmatchedAddress: []string{"霞町"},
			wantStructured: map[string]any{
				FieldPref:    "広島県",
				FieldCounty:  nil,
				FieldCity:    "福山市",
				FieldWard:    nil,
				FieldOazaCho: nil,
			},
		},
	})
}

package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue236 tests address normalization with Unicode Variation Selectors
// Issue #236: 特定都道府県/地域の正規化精度の低下
// https://github.com/digital-go-jp/abr-geocoder/issues/236
//
// 問題:
// - 愛媛県松山市三番町一丁目１３番地 が正規化できない
// - 入力文字列に異体字セレクタ (Variation Selector) U+E0103 が含まれている
// - 「愛媛󠄃県」(媛の後にU+E0103) が「愛媛県」として認識されず都道府県検出に失敗
//
// 解決:
// - NormalizeAddressText() で異体字セレクタを除去する処理を追加
// - VS1-VS16 (U+FE00-U+FE0F) と VS17-VS256 (U+E0100-U+E01EF) を除去
func TestIssue236(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === 正常動作確認用（異体字セレクタなし） ===
		{
			name: "issue236-baseline [愛媛県松山市三番町一丁目]",
			query: model.MatchQuery{
				Address:  "愛媛県松山市三番町一丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県松山市三番町一丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛媛県",
				FieldCounty:       nil,
				FieldCity:         "松山市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三番町",
				FieldChome:        "一丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 問題のあるケース（異体字セレクタ付き） ===
		// U+E0103 (VS20) が「媛」の後に挿入されている
		// エスケープ表記版
		{
			name: "issue236-1a [愛媛県松山市三番町一丁目] (escape notation)",
			query: model.MatchQuery{
				Address:  "愛媛\U000E0103県松山市三番町一丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県松山市三番町一丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛媛県",
				FieldCounty:       nil,
				FieldCity:         "松山市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三番町",
				FieldChome:        "一丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 実文字版（コピペで入力される実際のパターン）
		{
			name: "issue236-1b [愛媛県松山市三番町一丁目] (literal)",
			query: model.MatchQuery{
				Address:  "愛媛󠄃県松山市三番町一丁目", // 媛の後にU+E0103が実文字で入っている
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県松山市三番町一丁目",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛媛県",
				FieldCounty:       nil,
				FieldCity:         "松山市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三番町",
				FieldChome:        "一丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 番地付きのケース
		{
			name: "issue236-2 [愛媛県松山市三番町一丁目13番地] (with U+E0103)",
			query: model.MatchQuery{
				Address:  "愛媛\U000E0103県松山市三番町一丁目13番地",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県松山市三番町一丁目",
			wantUnmatchedAddress: []string{"13"},
			wantStructured: map[string]any{
				FieldPref:         "愛媛県",
				FieldCounty:       nil,
				FieldCity:         "松山市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三番町",
				FieldChome:        "一丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 他の異体字セレクタのケース ===
		// VS1 (U+FE00)
		{
			name: "issue236-3 [東京都港区虎ノ門] (with U+FE00)",
			query: model.MatchQuery{
				Address:  "東京\uFE00都港区虎ノ門",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "東京都港区虎ノ門",
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "港区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "虎ノ門",
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
		// VS16 (U+FE0F) - emoji variant selector
		{
			name: "issue236-4 [東京都港区虎ノ門] (with U+FE0F)",
			query: model.MatchQuery{
				Address:  "東京\uFE0F都港区虎ノ門",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "東京都港区虎ノ門",
			wantStructured: map[string]any{
				FieldPref:         "東京都",
				FieldCounty:       nil,
				FieldCity:         "港区",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "虎ノ門",
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
		// 複数の異体字セレクタ
		{
			name: "issue236-5 [愛媛県松山市三番町] (multiple VS)",
			query: model.MatchQuery{
				Address:  "愛\U000E0100媛\U000E0103県松山市三番町",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "愛媛県松山市三番町",
			wantStructured: map[string]any{
				FieldPref:         "愛媛県",
				FieldCounty:       nil,
				FieldCity:         "松山市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三番町",
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

		// === 三重県のケース（Issue報告に含まれていた） ===
		// 注意: 三重県のケースは異体字セレクタの問題ではなく、元々正常動作している
		{
			name: "issue236-6 [三重県四日市市西富田町]",
			query: model.MatchQuery{
				Address:  "三重県四日市市西富田町",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "三重県四日市市西富田町",
			wantStructured: map[string]any{
				FieldPref:         "三重県",
				FieldCounty:       nil,
				FieldCity:         "四日市市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "西富田町",
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
		// 番地付き
		{
			name: "issue236-6b [三重県四日市市西富田町６５５番地１]",
			query: model.MatchQuery{
				Address:  "三重県四日市市西富田町６５５番地１",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "三重県四日市市西富田町",
			wantUnmatchedAddress: []string{"655-1"},
			wantStructured: map[string]any{
				FieldPref:         "三重県",
				FieldCounty:       nil,
				FieldCity:         "四日市市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "西富田町",
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

		// === 大阪市天王寺区烏ヶ辻町のケース（Issue報告に含まれていた） ===
		// 注意: ABRデータでは「烏ケ辻」に丁目付きレコード（1丁目、2丁目）のみ存在し、
		// 基本レコード（丁目なし）がないため、丁目指定がないとマッチしない
		// 丁目を指定すれば正常にマッチする
		{
			name: "issue236-7 [大阪府大阪市天王寺区烏ケ辻一丁目]",
			query: model.MatchQuery{
				Address:  "大阪府大阪市天王寺区烏ケ辻一丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "大阪府大阪市天王寺区烏ケ辻1丁目",
			wantStructured: map[string]any{
				FieldPref:         "大阪府",
				FieldCounty:       nil,
				FieldCity:         "大阪市",
				FieldWard:         "天王寺区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "烏ケ辻",
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
		// 烏ケ辻二丁目
		{
			name: "issue236-8 [大阪府大阪市天王寺区烏ケ辻二丁目]",
			query: model.MatchQuery{
				Address:  "大阪府大阪市天王寺区烏ケ辻二丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "大阪府大阪市天王寺区烏ケ辻2丁目",
			wantStructured: map[string]any{
				FieldPref:         "大阪府",
				FieldCounty:       nil,
				FieldCity:         "大阪市",
				FieldWard:         "天王寺区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "烏ケ辻",
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
		// Issue報告の原文: 大阪市天王寺区烏ヶ辻町７４番地（府名なし）
		// ABRデータに「烏ケ辻」の丁目なし基本レコードがないため、類似検索で「石ケ辻町」に
		// マッチしようとするがスコアが低い(0.64)ため、市区町村レベルにフォールバック
		{
			name: "issue236-9 [大阪市天王寺区烏ヶ辻町74番地] (府名なし)",
			query: model.MatchQuery{
				Address:  "大阪市天王寺区烏ヶ辻町74番地",
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
		// 府名ありの場合も同様: 低スコアマッチを避けて市区町村レベルにフォールバック
		{
			name: "issue236-10 [大阪府大阪市天王寺区烏ヶ辻町74番地] (府名あり)",
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
	})
}

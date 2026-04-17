package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue196 tests place names containing "地割"
// Issue #196: 「地割」が省略される
// https://github.com/digital-go-jp/abr-geocoder/issues/196
//
// 問題:
// - 「第10地割」→「10」（「地割」が脱落）
// - 岩手県を中心に「地割」を含む地名が正しく認識されない
//
// 「地割」は地名の一部として正しく保持されるべき
func TestIssue196(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === 普代村パターン ===
		// oaza_cho が「第X地割字Y」の形式
		{
			name: "issue196-1 [岩手県下閉伊郡普代村第10地割羅賀]",
			query: model.MatchQuery{
				Address:  "岩手県下閉伊郡普代村第10地割羅賀",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "岩手県下閉伊郡普代村第10地割字羅賀",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "下閉伊郡",
				FieldCity:         "普代村",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "第10地割字羅賀",
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
		// 全角数字での入力
		{
			name: "issue196-2 [岩手県下閉伊郡普代村第１０地割羅賀]",
			query: model.MatchQuery{
				Address:  "岩手県下閉伊郡普代村第１０地割羅賀",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "岩手県下閉伊郡普代村第10地割字羅賀",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "下閉伊郡",
				FieldCity:         "普代村",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "第10地割字羅賀",
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
		// 第17地割野胡桃
		{
			name: "issue196-2a [岩手県下閉伊郡普代村第17地割野胡桃]",
			query: model.MatchQuery{
				Address:  "岩手県下閉伊郡普代村第17地割野胡桃",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "岩手県下閉伊郡普代村第17地割字野胡桃",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "下閉伊郡",
				FieldCity:         "普代村",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "第17地割字野胡桃",
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
		// 第22地割沢向
		{
			name: "issue196-2b [岩手県下閉伊郡普代村第22地割沢向]",
			query: model.MatchQuery{
				Address:  "岩手県下閉伊郡普代村第22地割沢向",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "岩手県下閉伊郡普代村第22地割字沢向",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "下閉伊郡",
				FieldCity:         "普代村",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "第22地割字沢向",
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
		// 第27地割茂市
		{
			name: "issue196-2c [岩手県下閉伊郡普代村第27地割茂市]",
			query: model.MatchQuery{
				Address:  "岩手県下閉伊郡普代村第27地割茂市",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "岩手県下閉伊郡普代村第27地割字茂市",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "下閉伊郡",
				FieldCity:         "普代村",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "第27地割字茂市",
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
		// 第31地割南股
		{
			name: "issue196-3 [岩手県下閉伊郡普代村第31地割南股]",
			query: model.MatchQuery{
				Address:  "岩手県下閉伊郡普代村第31地割南股",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "岩手県下閉伊郡普代村第31地割字南股",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "下閉伊郡",
				FieldCity:         "普代村",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "第31地割字南股",
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

		// === 大槌町金沢パターン ===
		// oaza_cho=金澤, koaza=第X地割 の形式
		// DB: oaza_cho=金澤（旧字体）で登録
		{
			name: "issue196-4 [岩手県上閉伊郡大槌町金沢第10地割]",
			query: model.MatchQuery{
				Address:  "岩手県上閉伊郡大槌町金沢第10地割",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県上閉伊郡大槌町金澤第10地割",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "上閉伊郡",
				FieldCity:         "大槌町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "金澤",
				FieldChome:        nil,
				FieldKoaza:        "第10地割",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 全角数字での入力
		{
			name: "issue196-5 [岩手県上閉伊郡大槌町金沢第１０地割]",
			query: model.MatchQuery{
				Address:  "岩手県上閉伊郡大槌町金沢第１０地割",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県上閉伊郡大槌町金澤第10地割",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "上閉伊郡",
				FieldCity:         "大槌町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "金澤",
				FieldChome:        nil,
				FieldKoaza:        "第10地割",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 第18地割
		{
			name: "issue196-6 [岩手県上閉伊郡大槌町金澤第18地割]",
			query: model.MatchQuery{
				Address:  "岩手県上閉伊郡大槌町金澤第18地割",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県上閉伊郡大槌町金澤第18地割",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "上閉伊郡",
				FieldCity:         "大槌町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "金澤",
				FieldChome:        nil,
				FieldKoaza:        "第18地割",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 宮古市パターン ===
		// oaza_cho=赤前, koaza=第X地割 の形式
		{
			name: "issue196-7 [岩手県宮古市赤前第13地割]",
			query: model.MatchQuery{
				Address:  "岩手県宮古市赤前第13地割",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県宮古市赤前第13地割",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       nil,
				FieldCity:         "宮古市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "赤前",
				FieldChome:        nil,
				FieldKoaza:        "第13地割",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 盛岡市パターン ===
		// 「第」なしの地割（oaza_cho=上飯岡, koaza=7地割）
		{
			name: "issue196-8 [岩手県盛岡市上飯岡7地割]",
			query: model.MatchQuery{
				Address:  "岩手県盛岡市上飯岡7地割",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県盛岡市上飯岡7地割",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       nil,
				FieldCity:         "盛岡市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "上飯岡",
				FieldChome:        nil,
				FieldKoaza:        "7地割",
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

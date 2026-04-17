package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue198 tests place names containing "番"
// Issue #198: 「番」を含む地名のテスト
// https://github.com/digital-go-jp/abr-geocoder/issues/198
//
// 問題:
// - 「番」を含む地名が正規化時に「番」が脱落して認識されてしまう
// - 例：「番の州町」→「の州町」、「七番江」→「七江」
//
// 「番」は地名の一部として正しく保持されるべき
func TestIssue198(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// status_flg=0 のためコメントアウト (lg_code=331031, machiaza_id=0000168)
		// {
		// 	name: "issue198-1a [岡山市東区四番屋]",
		// 	query: model.MatchQuery{
		// 		Address: "岡山県岡山市東区四番屋",
		// 		Category:  model.CategoryAll,
		// 		Pref: "all",
		// 		Limit:   1,
		// 	},
		// 	wantMatchLevel:       model.MatchLevelMachiazaDetail,
		// 	wantMatchedAddress:   "岡山県岡山市東区四番屋",
		// 	wantUnmatchedAddress: nil,
		// 	wantStructured: map[string]any{
		// 		FieldPref:  "岡山県",
		// 		FieldCity:  "岡山市",
		// 		FieldWard:  "東区",
		// 		FieldKoaza: "四番屋",
		// 	},
		// },
		// status_flg=0 のためコメントアウト (lg_code=331040, machiaza_id=0000103)
		// {
		// 	name: "issue198-1b [岡山市南区一番開墾]",
		// 	query: model.MatchQuery{
		// 		Address: "岡山県岡山市南区一番開墾",
		// 		Category:  model.CategoryAll,
		// 		Pref: "all",
		// 		Limit:   1,
		// 	},
		// 	wantMatchLevel:       model.MatchLevelMachiazaDetail,
		// 	wantMatchedAddress:   "岡山県岡山市南区一番開墾",
		// 	wantUnmatchedAddress: nil,
		// 	wantStructured: map[string]any{
		// 		FieldPref:  "岡山県",
		// 		FieldCity:  "岡山市",
		// 		FieldWard:  "南区",
		// 		FieldKoaza: "一番開墾",
		// 	},
		// },
		{
			name: "issue198-2 [香川県坂出市番の州公園]",
			query: model.MatchQuery{
				Address:  "香川県坂出市番の州公園",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県坂出市番の州公園",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "坂出市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "番の州公園",
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
		{
			name: "issue198-3 [宮城県登米市豊里町東六番江]",
			query: model.MatchQuery{
				Address:  "宮城県登米市豊里町東六番江",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県登米市豊里町東六番江",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "宮城県",
				FieldCounty:       nil,
				FieldCity:         "登米市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "豊里町",
				FieldChome:        nil,
				FieldKoaza:        "東六番江",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 追加テストケース (GitHub issue #198 より) ===
		// 番の州町: 「番の州」で始まる地名（坂出市）
		{
			name: "issue198-4 [香川県坂出市番の州町]",
			query: model.MatchQuery{
				Address:  "香川県坂出市番の州町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県坂出市番の州町",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "坂出市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "番の州町",
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
		// 番の州緑町
		{
			name: "issue198-5 [香川県坂出市番の州緑町]",
			query: model.MatchQuery{
				Address:  "香川県坂出市番の州緑町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県坂出市番の州緑町",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "坂出市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "番の州緑町",
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

		// 美旗町中一番: 「○番」が地名に含まれるケース（名張市）
		// DB: normalized_address=美旗町中1番, oaza_cho=美旗町中1番
		{
			name: "issue198-6 [三重県名張市美旗町中一番]",
			query: model.MatchQuery{
				Address:  "三重県名張市美旗町中一番",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "三重県名張市美旗町中1番",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "三重県",
				FieldCounty:       nil,
				FieldCity:         "名張市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "美旗町中1番",
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
		// 美旗町中二番
		{
			name: "issue198-7 [三重県名張市美旗町中二番]",
			query: model.MatchQuery{
				Address:  "三重県名張市美旗町中二番",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "三重県名張市美旗町中2番",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "三重県",
				FieldCounty:       nil,
				FieldCity:         "名張市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "美旗町中2番",
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

		// 豊里町七番江: 「番江」で終わる小字パターン（登米市）
		// DB: normalized_address=登米市豊里町7番江, oaza_cho=豊里町, koaza=七番江
		{
			name: "issue198-8 [宮城県登米市豊里町七番江]",
			query: model.MatchQuery{
				Address:  "宮城県登米市豊里町七番江",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県登米市豊里町七番江",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "宮城県",
				FieldCounty:       nil,
				FieldCity:         "登米市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "豊里町",
				FieldChome:        nil,
				FieldKoaza:        "七番江",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 豊里町東七番江
		{
			name: "issue198-9 [宮城県登米市豊里町東七番江]",
			query: model.MatchQuery{
				Address:  "宮城県登米市豊里町東七番江",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県登米市豊里町東七番江",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "宮城県",
				FieldCounty:       nil,
				FieldCity:         "登米市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "豊里町",
				FieldChome:        nil,
				FieldKoaza:        "東七番江",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 豊里町西五番江
		{
			name: "issue198-10 [宮城県登米市豊里町西五番江]",
			query: model.MatchQuery{
				Address:  "宮城県登米市豊里町西五番江",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県登米市豊里町西五番江",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "宮城県",
				FieldCounty:       nil,
				FieldCity:         "登米市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "豊里町",
				FieldChome:        nil,
				FieldKoaza:        "西五番江",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 大洲市恋木パターン ===
		// 「恋」の読みが「こい」（issue #198で報告）
		{
			name: "issue198-11 [愛媛県大洲市恋木]",
			query: model.MatchQuery{
				Address:  "愛媛県大洲市恋木",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "愛媛県大洲市恋木",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛媛県",
				FieldCounty:       nil,
				FieldCity:         "大洲市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "恋木",
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
		// 恋木甲
		{
			name: "issue198-12 [愛媛県大洲市恋木甲]",
			query: model.MatchQuery{
				Address:  "愛媛県大洲市恋木甲",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県大洲市恋木甲",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "愛媛県",
				FieldCounty:       nil,
				FieldCity:         "大洲市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "恋木",
				FieldChome:        nil,
				FieldKoaza:        "甲",
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

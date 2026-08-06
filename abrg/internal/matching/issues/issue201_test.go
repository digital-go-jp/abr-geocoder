package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue201 tests addresses where trailing kanji numerals might be duplicated
// Issue #201: 末尾の漢数字が重複する
// https://github.com/digital-go-jp/abr-geocoder/issues/201
//
// 漢数字の小字で末尾を重複させないことを確認する。
// 該当する小字が存在しない場合は町字レベルでマッチし、元の表記が未マッチに残る。
func TestIssue201(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 石川県加賀市大聖寺上木町 - 小字「九十五」(正規化形95) にマッチ（issue #259）
			// 「九十五」のまま小字としてマッチする
			name: "issue201-1 [石川県加賀市大聖寺上木町九十五]",
			query: model.MatchQuery{
				Address:  "石川県加賀市大聖寺上木町九十五",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県加賀市大聖寺上木町九十五",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       nil,
				FieldCity:         "加賀市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大聖寺上木町",
				FieldChome:        nil,
				FieldKoaza:        "九十五",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 石川県加賀市大聖寺上木町九十五ノ - DBの小字「95の」に完全マッチする正常ケース
			name: "issue201-1b [石川県加賀市大聖寺上木町九十五ノ]",
			query: model.MatchQuery{
				Address:  "石川県加賀市大聖寺上木町九十五ノ",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県加賀市大聖寺上木町95の",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       nil,
				FieldCity:         "加賀市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大聖寺上木町",
				FieldChome:        nil,
				FieldKoaza:        "95の",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 熊本県玉名郡南関町七十三 - 七十三は存在しない町字
			// 市区町村までマッチし、七十三は元の表記のまま未マッチに残る
			name: "issue201-2 [熊本県玉名郡南関町七十三]",
			query: model.MatchQuery{
				Address:  "熊本県玉名郡南関町七十三",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "熊本県玉名郡南関町",
			wantUnmatchedAddress: []string{"七十三"},
			wantStructured: map[string]any{
				FieldPref:         "熊本県",
				FieldCounty:       "玉名郡",
				FieldCity:         "南関町",
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
		{
			// 福島県田村市三十八 - 三十八は存在しない町字
			// 市区町村までマッチし、三十八は元の表記のまま未マッチに残る
			name: "issue201-3 [福島県田村市三十八]",
			query: model.MatchQuery{
				Address:  "福島県田村市三十八",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "福島県田村市",
			wantUnmatchedAddress: []string{"三十八"},
			wantStructured: map[string]any{
				FieldPref:         "福島県",
				FieldCounty:       nil,
				FieldCity:         "田村市",
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
	})
}

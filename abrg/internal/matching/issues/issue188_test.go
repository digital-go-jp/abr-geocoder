package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue188 tests addresses ending with "条" (jou)
// Issue #188: 「条」が重複
// https://github.com/digital-go-jp/abr-geocoder/issues/188
//
// 「条」で終わる町字名を、条の処理で重複させないことを確認する。
func TestIssue188(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 千葉県夷隅郡大多喜町三条 - 「三条」という町字
			name: "issue188-1 [千葉県夷隅郡大多喜町三条]",
			query: model.MatchQuery{
				Address:  "千葉県夷隅郡大多喜町三条",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "千葉県夷隅郡大多喜町三条",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "千葉県",
				FieldCounty:       "夷隅郡",
				FieldCity:         "大多喜町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三条",
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
			// 北海道札幌市西区発寒6条3丁目 - 「N条」という町字パターン
			// 北海道の条を含む住所が正しく認識されることを確認
			name: "issue188-2 [北海道札幌市西区発寒6条3丁目2-7]",
			query: model.MatchQuery{
				Address:  "北海道札幌市西区発寒6条3丁目2-7",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "北海道札幌市西区発寒6条3丁目2-7",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "札幌市",
				FieldWard:         "西区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "発寒6条",
				FieldChome:        "3丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       "2",
				FieldRsdtNum:      "7",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			// 京都府京都市中京区 - 京都通り名に「二条」を含む住所
			// 「二条」が「二条条」にならないことを確認
			name: "issue188-3 [京都府京都市中京区河原町通二条下る一筋目東入一之船入町]",
			query: model.MatchQuery{
				Address:  "京都府京都市中京区河原町通二条下る一筋目東入一之船入町",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "京都府京都市中京区河原町通二条下る一筋目東入一之船入町",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "京都府",
				FieldCounty:       nil,
				FieldCity:         "京都市",
				FieldWard:         "中京区",
				FieldMachiazaDist: nil,
				FieldKyotoSt:      "河原町通二条下る一筋目東入",
				FieldOazaCho:      "一之船入町",
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

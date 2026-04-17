package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue166 tests half-width katakana "ｹ" in city/town names
// Issue #166: 半角カタカナの「ｹ」が市区町村名にヒットしない
// https://github.com/digital-go-jp/abr-geocoder/issues/166
//
// 問題:
//   - 半角カタカナ「ｹ」を含む市町村名（金ｹ崎町、龍ｹ崎市、鎌ｹ谷市、関ｹ原町）が
//     正しくマッチしない（prefecture止まり）
//
// 半角カタカナは全角カタカナに正規化されるべき
func TestIssue166(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue166-1 [岩手県胆沢郡金ｹ崎町西根大谷120]",
			query: model.MatchQuery{
				Address:  "岩手県胆沢郡金ｹ崎町西根大谷120 金ケ崎小学校",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県胆沢郡金ケ崎町西根大谷",
			wantUnmatchedAddress: []string{"120", "金ケ崎小学校"},
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "胆沢郡",
				FieldCity:         "金ケ崎町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "西根",
				FieldChome:        nil,
				FieldKoaza:        "大谷",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue166-2 [岩手県胆沢郡金ｹ崎町西根二ﾂ堤45-24]",
			query: model.MatchQuery{
				Address:  "岩手県胆沢郡金ｹ崎町西根二ﾂ堤45-24 第一小学校",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "岩手県胆沢郡金ケ崎町西根二ツ堤45-24",
			wantUnmatchedAddress: []string{"第一小学校"},
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "胆沢郡",
				FieldCity:         "金ケ崎町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "西根",
				FieldChome:        nil,
				FieldKoaza:        "二ツ堤",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "45",
				FieldPrcNum2:      "24",
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue166-3 [茨城県龍ｹ崎市大徳町4945]",
			query: model.MatchQuery{
				Address:  "茨城県龍ｹ崎市大徳町4945 大宮小学校",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "茨城県龍ケ崎市大徳町4945",
			wantUnmatchedAddress: []string{"大宮小学校"},
			wantStructured: map[string]any{
				FieldPref:         "茨城県",
				FieldCounty:       nil,
				FieldCity:         "龍ケ崎市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大徳町",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "4945",
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// === Issue報告の具体例 ===
		// 千葉県鎌ｹ谷市
		{
			name: "issue166-4 [千葉県鎌ｹ谷市中央2-1-1]",
			query: model.MatchQuery{
				Address:  "千葉県鎌ｹ谷市中央2-1-1",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelResidentialDetail,
			wantMatchedAddress:   "千葉県鎌ケ谷市中央二丁目1-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "千葉県",
				FieldCounty:       nil,
				FieldCity:         "鎌ケ谷市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "中央",
				FieldChome:        "二丁目",
				FieldKoaza:        nil,
				FieldBlkNum:       "1",
				FieldRsdtNum:      "1",
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 岐阜県不破郡関ｹ原町
		{
			name: "issue166-5 [岐阜県不破郡関ｹ原町関ヶ原3132-3]",
			query: model.MatchQuery{
				Address:  "岐阜県不破郡関ｹ原町関ヶ原3132-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "岐阜県不破郡関ケ原町大字関ケ原3132-3",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岐阜県",
				FieldCounty:       "不破郡",
				FieldCity:         "関ケ原町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字関ケ原",
				FieldChome:        nil,
				FieldKoaza:        nil,
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "3132",
				FieldPrcNum2:      "3",
				FieldPrcNum3:      nil,
			},
		},
	})
}

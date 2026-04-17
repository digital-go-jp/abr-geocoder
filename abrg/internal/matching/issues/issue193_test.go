package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue193 tests place names containing "号"
// Issue #193: 「号」が省略される
// https://github.com/digital-go-jp/abr-geocoder/issues/193
//
// 問題:
// - 「二十一号」→「二十一」（「号」が脱落）
// - 北海道や石川県などで「N号」を含む地名が正しく認識されない
//
// 「号」は地名の一部として正しく保持されるべき
func TestIssue193(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === 浜中町パターン ===
		// koaza が「字姉別原野東N号南/北」の形式
		{
			name: "issue193-1 [浜中町姉別原野東二十号南]",
			query: model.MatchQuery{
				Address:  "北海道厚岸郡浜中町大字後静村字姉別原野東二十号南",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道厚岸郡浜中町大字後静村字姉別原野東20号南",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "厚岸郡",
				FieldCity:         "浜中町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字後静村",
				FieldChome:        nil,
				FieldKoaza:        "字姉別原野東20号南",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue193-2 [浜中町姉別原野東二十五号北]",
			query: model.MatchQuery{
				Address:  "北海道厚岸郡浜中町大字後静村字姉別原野東二十五号北",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道厚岸郡浜中町大字後静村字姉別原野東25号北",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "厚岸郡",
				FieldCity:         "浜中町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字後静村",
				FieldChome:        nil,
				FieldKoaza:        "字姉別原野東25号北",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 宝達志水町パターン ===
		// koaza が「壱弐号ヤドミ」の形式（大字漢数字）
		{
			name: "issue193-3 [宝達志水町壱弐号ヤドミ]",
			query: model.MatchQuery{
				Address:  "石川県羽咋郡宝達志水町紺屋町外七字入会壱弐号ヤドミ",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県羽咋郡宝達志水町紺屋町外七字入会壱弐号ヤドミ",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "石川県",
				FieldCounty:       "羽咋郡",
				FieldCity:         "宝達志水町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "紺屋町外七字入会",
				FieldChome:        nil,
				FieldKoaza:        "壱弐号ヤドミ",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 旭川市パターン ===
		// oaza_cho=西神楽1線, koaza=24号 の形式（北海道殖民地割）
		// 「n線n号」パターンは変換せずそのまま維持する
		{
			name: "issue193-4 [旭川市西神楽1線24号]",
			query: model.MatchQuery{
				Address:  "北海道旭川市西神楽1線24号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道旭川市西神楽1線24号",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "旭川市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "西神楽1線",
				FieldChome:        nil,
				FieldKoaza:        "24号",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 漢数字入力
		{
			name: "issue193-5 [旭川市西神楽一線二十四号]",
			query: model.MatchQuery{
				Address:  "北海道旭川市西神楽一線二十四号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道旭川市西神楽1線24号",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "旭川市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "西神楽1線",
				FieldChome:        nil,
				FieldKoaza:        "24号",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 東鷹栖パターン
		{
			name: "issue193-6 [旭川市東鷹栖1線11号]",
			query: model.MatchQuery{
				Address:  "北海道旭川市東鷹栖1線11号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道旭川市東鷹栖1線11号",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "旭川市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "東鷹栖1線",
				FieldChome:        nil,
				FieldKoaza:        "11号",
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

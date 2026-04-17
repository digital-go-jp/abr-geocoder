package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue192 tests place names containing "線" suffix
// Issue #192: 「線」が「号」に置換されてしまう
// https://github.com/digital-go-jp/abr-geocoder/issues/192
//
// 問題:
// - 「七線」→「七号」（「線」が「号」に誤変換）
// - 北海道上川郡鷹栖町などで「N線」を含む地名が正しく認識されない
//
// 「線」は地名の一部として正しく保持されるべき
func TestIssue192(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === 鷹栖町パターン ===
		// oaza_cho が「N線」の形式（北海道殖民地割）
		// DB: oaza_cho=7線, 8線, 9線, 10線 など（アラビア数字）
		{
			name: "issue192-1 [北海道上川郡鷹栖町七線]",
			query: model.MatchQuery{
				Address:  "北海道上川郡鷹栖町七線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道上川郡鷹栖町7線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "上川郡",
				FieldCity:         "鷹栖町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "7線",
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
			name: "issue192-2 [北海道上川郡鷹栖町八線]",
			query: model.MatchQuery{
				Address:  "北海道上川郡鷹栖町八線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道上川郡鷹栖町8線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "上川郡",
				FieldCity:         "鷹栖町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "8線",
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
			name: "issue192-3 [北海道上川郡鷹栖町九線]",
			query: model.MatchQuery{
				Address:  "北海道上川郡鷹栖町九線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道上川郡鷹栖町9線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "上川郡",
				FieldCity:         "鷹栖町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "9線",
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
			name: "issue192-4 [北海道上川郡鷹栖町十線]",
			query: model.MatchQuery{
				Address:  "北海道上川郡鷹栖町十線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道上川郡鷹栖町10線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "上川郡",
				FieldCity:         "鷹栖町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "10線",
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
		// アラビア数字での入力
		{
			name: "issue192-5 [北海道上川郡鷹栖町7線]",
			query: model.MatchQuery{
				Address:  "北海道上川郡鷹栖町7線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道上川郡鷹栖町7線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "上川郡",
				FieldCity:         "鷹栖町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "7線",
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
		// 線西+号パターン（方角付き+小字）
		// DB: oaza_cho=10線西, koaza=5号 が存在（normalized_address=上川郡鷹栖町10線西5号）
		{
			name: "issue192-6 [北海道上川郡鷹栖町10線西5号]",
			query: model.MatchQuery{
				Address:  "北海道上川郡鷹栖町10線西5号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道上川郡鷹栖町10線西5号",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "上川郡",
				FieldCity:         "鷹栖町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "10線西",
				FieldChome:        nil,
				FieldKoaza:        "5号",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},

		// === 線+号パターン（小字レベル） ===
		// oaza_cho=7線, koaza=1号 の形式
		// DBに 7線1号 は存在しない（7線の koaza は 10号, 11号, 12号 のみ）
		{
			name: "issue192-7 [北海道上川郡鷹栖町七線一号]",
			query: model.MatchQuery{
				Address:  "北海道上川郡鷹栖町七線一号",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道上川郡鷹栖町7線",
			wantUnmatchedAddress: []string{"一号"},
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "上川郡",
				FieldCity:         "鷹栖町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "7線",
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

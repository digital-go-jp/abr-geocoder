package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue194 tests place names containing "丁" suffix
// Issue #194: 「丁」が省略される
// https://github.com/digital-go-jp/abr-geocoder/issues/194
//
// 問題:
// - 「一番丁」→「一」（「丁」が脱落）
// - 「七番丁」→「七条」（誤変換）
//
// 「番丁」は地名の一部として正しく保持されるべき
// Note: この問題は issue #195 と同様の問題（「番丁」が省略される）
func TestIssue194(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// === 丸亀市パターン ===
		// issueで報告された住所: 香川県丸亀市一番丁
		// DB: oaza_cho=一番丁（漢数字）
		{
			name: "issue194-1 [香川県丸亀市一番丁]",
			query: model.MatchQuery{
				Address:  "香川県丸亀市一番丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県丸亀市一番丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "丸亀市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "一番丁",
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
		// issueで報告された住所: 香川県丸亀市七番丁
		{
			name: "issue194-2 [香川県丸亀市七番丁]",
			query: model.MatchQuery{
				Address:  "香川県丸亀市七番丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県丸亀市七番丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "丸亀市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "七番丁",
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

		// issueで報告された住所: 香川県丸亀市六番丁
		{
			name: "issue194-2a [香川県丸亀市六番丁]",
			query: model.MatchQuery{
				Address:  "香川県丸亀市六番丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県丸亀市六番丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "丸亀市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "六番丁",
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
		// issueで報告された住所: 香川県丸亀市八番丁
		{
			name: "issue194-2b [香川県丸亀市八番丁]",
			query: model.MatchQuery{
				Address:  "香川県丸亀市八番丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県丸亀市八番丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "丸亀市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "八番丁",
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
		// issueで報告された住所: 香川県丸亀市九番丁
		{
			name: "issue194-2c [香川県丸亀市九番丁]",
			query: model.MatchQuery{
				Address:  "香川県丸亀市九番丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県丸亀市九番丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "丸亀市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "九番丁",
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
		// issueで報告された住所: 香川県丸亀市十番丁
		{
			name: "issue194-2d [香川県丸亀市十番丁]",
			query: model.MatchQuery{
				Address:  "香川県丸亀市十番丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "香川県丸亀市十番丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "香川県",
				FieldCounty:       nil,
				FieldCity:         "丸亀市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "十番丁",
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

		// === 和歌山市パターン ===
		// issueで報告された住所: 和歌山県和歌山市一番丁
		{
			name: "issue194-3 [和歌山県和歌山市一番丁]",
			query: model.MatchQuery{
				Address:  "和歌山県和歌山市一番丁",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "和歌山県和歌山市一番丁",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "和歌山県",
				FieldCounty:       nil,
				FieldCity:         "和歌山市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "一番丁",
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

package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue191 tests place names containing "線" (line)
// Issue #191: 「線」が消える
// https://github.com/digital-go-jp/abr-geocoder/issues/191
//
// 問題:
// - 「北海道釧路市新野七線」→「北海道釧路市新野七」（「線」が削除される）
// - 「北海道厚岸郡厚岸町別寒辺牛村字茶内原野西二十一線」→「...西二十」（「一線」が削除される）
//
// 北海道の殖民地割の「線」表記が正しく保持されるべき
func TestIssue191(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		// status_flg=0 のためコメントアウト (lg_code=012203, koaza=北一線)
		// {
		// 	name: "issue191-1 [士別市北一線]",
		// 	query: model.MatchQuery{
		// 		Address: "北海道士別市北一線",
		// 		Category:  model.CategoryAll,
		// 		Pref: "all",
		// 		Limit:   1,
		// 	},
		// 	wantMatchLevel:       model.MatchLevelMachiazaDetail,
		// 	wantMatchedAddress:   "北海道士別市北一線",
		// 	wantUnmatchedAddress: nil,
		// 	wantStructured: map[string]any{
		// 		FieldPref:  "北海道",
		// 		FieldCity:  "士別市",
		// 		FieldKoaza: "北一線",
		// 	},
		// },
		{
			name: "issue191-1a [北海道士別市温根別町北一線]",
			query: model.MatchQuery{
				Address:  "北海道士別市温根別町北一線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道士別市温根別町北1線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "士別市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "温根別町",
				FieldChome:        nil,
				FieldKoaza:        "北1線",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue191-2 [北海道釧路市新野七線]",
			query: model.MatchQuery{
				Address:  "北海道釧路市新野七線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道釧路市新野7線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "釧路市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "新野7線",
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
			name: "issue191-3 [北海道厚岸郡浜中町後静村姉別原野南9線]",
			query: model.MatchQuery{
				Address:  "北海道厚岸郡浜中町後静村姉別原野南9線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道厚岸郡浜中町大字後静村字姉別原野南9線",
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
				FieldKoaza:        "字姉別原野南9線",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// === Issue報告の具体例 ===
		// 「茶内原野西二十一線」→「茶内原野西二十」となってしまう問題
		{
			name: "issue191-4 [北海道厚岸郡浜中町浜中村茶内原野西二十一線]",
			query: model.MatchQuery{
				Address:  "北海道厚岸郡浜中町浜中村茶内原野西二十一線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道厚岸郡浜中町大字浜中村字茶内原野西21線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "厚岸郡",
				FieldCity:         "浜中町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字浜中村",
				FieldChome:        nil,
				FieldKoaza:        "字茶内原野西21線",
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
			name: "issue191-5 [北海道厚岸郡浜中町浜中村茶内原野西21線]",
			query: model.MatchQuery{
				Address:  "北海道厚岸郡浜中町浜中村茶内原野西21線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道厚岸郡浜中町大字浜中村字茶内原野西21線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       "厚岸郡",
				FieldCity:         "浜中町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字浜中村",
				FieldChome:        nil,
				FieldKoaza:        "字茶内原野西21線",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		// 新野八線（漢数字）
		{
			name: "issue191-6 [北海道釧路市新野八線]",
			query: model.MatchQuery{
				Address:  "北海道釧路市新野八線",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "北海道釧路市新野8線",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "北海道",
				FieldCounty:       nil,
				FieldCity:         "釧路市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "新野8線",
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

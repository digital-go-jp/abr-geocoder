package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue186 tests addresses ending with "部" (bu)
// Issue #186: 「部」が重複
// https://github.com/digital-go-jp/abr-geocoder/issues/186
//
// 「部」で終わる町字名を、接尾辞の処理で重複させないことを確認する。
func TestIssue186(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 鳥取県西伯郡伯耆町三部 - 「三部」という町字
			name: "issue186-1 [鳥取県西伯郡伯耆町三部]",
			query: model.MatchQuery{
				Address:  "鳥取県西伯郡伯耆町三部",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "鳥取県西伯郡伯耆町三部",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "鳥取県",
				FieldCounty:       "西伯郡",
				FieldCity:         "伯耆町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "三部",
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
			// 鳥取県米子市一部 - 「一部」という町字
			name: "issue186-2 [鳥取県米子市一部]",
			query: model.MatchQuery{
				Address:  "鳥取県米子市一部",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "鳥取県米子市一部",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "鳥取県",
				FieldCounty:       nil,
				FieldCity:         "米子市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "一部",
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
			// 熊本県荒尾市一部 - 「一部」という町字
			name: "issue186-3 [熊本県荒尾市一部]",
			query: model.MatchQuery{
				Address:  "熊本県荒尾市一部",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "熊本県荒尾市一部",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "熊本県",
				FieldCounty:       nil,
				FieldCity:         "荒尾市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "一部",
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

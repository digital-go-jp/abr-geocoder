package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue133 tests chiwari (地割) patterns in addresses
// Issue #133: 地割のケース（市区町村名に漢数字を含む）
func TestIssue133(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue133-1 [岩手県八幡平市大更第35地割]",
			query: model.MatchQuery{
				Address:  "岩手県八幡平市大更第35地割",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県八幡平市大更第35地割",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       nil,
				FieldCity:         "八幡平市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大更",
				FieldChome:        nil,
				FieldKoaza:        "第35地割",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue133-2 [岩手県八幡平市大更第35地割4-2]",
			query: model.MatchQuery{
				Address:  "岩手県八幡平市大更第35地割4-2",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "岩手県八幡平市大更第35地割4-2",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       nil,
				FieldCity:         "八幡平市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大更",
				FieldChome:        nil,
				FieldKoaza:        "第35地割",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      "4",
				FieldPrcNum2:      "2",
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue133-3 [喜多方市高郷町磐見下地割甲]",
			query: model.MatchQuery{
				Address:  "喜多方市高郷町磐見下地割甲",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "福島県喜多方市高郷町磐見字下地割甲",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "福島県",
				FieldCounty:       nil,
				FieldCity:         "喜多方市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "高郷町磐見",
				FieldChome:        nil,
				FieldKoaza:        "字下地割甲",
				FieldBlkNum:       nil,
				FieldRsdtNum:      nil,
				FieldRsdtNum2:     nil,
				FieldPrcNum1:      nil,
				FieldPrcNum2:      nil,
				FieldPrcNum3:      nil,
			},
		},
		{
			name: "issue133-4 [岩手郡雫石町鴬宿第8地割800平]",
			query: model.MatchQuery{
				Address:  "岩手郡雫石町鴬宿第8地割800平",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県岩手郡雫石町大字鴬宿第8地割字八百平",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:         "岩手県",
				FieldCounty:       "岩手郡",
				FieldCity:         "雫石町",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "大字鴬宿",
				FieldChome:        nil,
				FieldKoaza:        "第8地割字八百平",
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

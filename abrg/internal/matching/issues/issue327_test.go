package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue327 covers a hyphen written directly after 丁目. The hyphen stands
// where the boundary between the chome and the address numbers belongs, so the
// numbers have to reach the block and residence level.
// https://github.com/digital-go-jp/abr-geocoder/issues/327
func TestIssue327(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue327-1 [東京都中央区銀座1丁目-5-2] hyphen after chome",
			query: model.MatchQuery{
				Address:  "東京都中央区銀座1丁目-5-2",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelResidentialDetail,
			wantMatchedAddress: "東京都中央区銀座1丁目5-2",
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "中央区",
				FieldChome:   "1丁目",
				FieldBlkNum:  "5",
				FieldRsdtNum: "2",
			},
		},
		{
			name: "issue327-2 [大阪府大阪市北区梅田1丁目-1-3] hyphen after chome",
			query: model.MatchQuery{
				Address:  "大阪府大阪市北区梅田1丁目-1-3",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelResidentialDetail,
			wantMatchedAddress: "大阪府大阪市北区梅田1丁目1-3",
			wantStructured: map[string]any{
				FieldPref:    "大阪府",
				FieldCity:    "大阪市",
				FieldWard:    "北区",
				FieldChome:   "1丁目",
				FieldBlkNum:  "1",
				FieldRsdtNum: "3",
			},
		},
		{
			// The same address without the hyphen reaches the same record.
			name: "issue327-3 [東京都中央区銀座1丁目5-2] no hyphen after chome",
			query: model.MatchQuery{
				Address:  "東京都中央区銀座1丁目5-2",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelResidentialDetail,
			wantMatchedAddress: "東京都中央区銀座1丁目5-2",
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "中央区",
				FieldChome:   "1丁目",
				FieldBlkNum:  "5",
				FieldRsdtNum: "2",
			},
		},
	})
}

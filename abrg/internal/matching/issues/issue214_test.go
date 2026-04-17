package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue214 tests handling of addresses with special characters that cause freezing in Node.js version
// Issue #214: API serverにおいてgeocode中にフリーズしてしまう・server側におけるTimeoutの設定Option
// https://github.com/digital-go-jp/abr-geocoder/issues/214
//
// The Node.js version freezes when processing addresses containing special characters
// like full-width numbers and alphabets (e.g., "ＴＥＬ　０　００").
// This test verifies that the Go implementation handles such inputs correctly without hanging.
func TestIssue214(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue214-1 [いすみ市若山　１－１　ＴＥＬ　０　００] address with full-width chars and noise",
			query: model.MatchQuery{
				Address:  "いすみ市若山　１－１　ＴＥＬ　０　００",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "千葉県いすみ市若山",
			wantUnmatchedAddress: []string{"1-1", "TEL", "0", "00"},
			wantStructured: map[string]any{
				FieldPref:         "千葉県",
				FieldCounty:       nil,
				FieldCity:         "いすみ市",
				FieldWard:         nil,
				FieldMachiazaDist: nil,
				FieldKyotoSt:      nil,
				FieldOazaCho:      "若山",
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

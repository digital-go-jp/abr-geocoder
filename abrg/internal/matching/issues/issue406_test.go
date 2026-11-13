package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue406 covers category=basic on a town that matches no machiaza
// exactly.
// It goes to the same fuzzy search as category=all instead of stopping at
// the city, and leaves the number section unmatched.
// Issue #406: 新ABRで町字認識が行われず city レベルで停止するケースが多数発生
// Issue #407: 新ABRで町名の表記揺れ補正が行われず町字認識失敗
// https://github.com/digital-go-jp/abr-geocoder/issues/406
func TestIssue406(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: model.CategoryBasic,
			Pref:     "all",
			Limit:    1,
		}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			// 神田和泉町 has no chome, so 一丁目 stays with the number section.
			name:                 "issue406-1 [東京都千代田区神田和泉町一丁目６番１６号ヤマトビル４０５] chome not in the town",
			query:                query("東京都千代田区神田和泉町一丁目６番１６号ヤマトビル４０５"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都千代田区神田和泉町",
			wantUnmatchedAddress: []string{"1-6-16", "ヤマトビル405"},
		},
		{
			name:                 "issue407-1 [東京都千代田区神田美士代町７番地３] misspelled town",
			query:                query("東京都千代田区神田美士代町７番地３"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都千代田区神田美土代町",
			wantUnmatchedAddress: []string{"7-3"},
		},
		{
			// The town is right before the parcel-number prefix (issue #354).
			name:                 "issue406-2 [群馬県吾妻郡東吾妻町大字三島ヰ6697番地] parcel-number prefix",
			query:                query("群馬県吾妻郡東吾妻町大字三島ヰ6697番地"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "群馬県吾妻郡東吾妻町大字三島",
			wantUnmatchedAddress: []string{"ヰ6697"},
		},
		{
			// The lot number is not taken as a chome (issue #365).
			name:                 "issue406-3 [神奈川県川崎市幸区鹿島田1004番地] lot number is not a chome",
			query:                query("神奈川県川崎市幸区鹿島田1004番地"),
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "神奈川県川崎市幸区",
			wantUnmatchedAddress: []string{"鹿島田1004"},
		},
	})
}

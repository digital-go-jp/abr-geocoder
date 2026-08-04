package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue341 covers municipality names that contain a kanji numeral, given
// as 都道府県 + 郡 + 市区町村 with no town after them. The city-boundary
// dictionary is matched against normalized text, so it has to hold the
// normalized form of the names as well.
// https://github.com/digital-go-jp/abr-geocoder/issues/341
func TestIssue341(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			// 三春町 used to be cut at the first 市/町/村 marker and reached
			// 田村市 (lg_code 072117) instead of 075213.
			name:               "issue341-1 [福島県田村郡三春町] kanji numeral in a town name",
			query:              query("福島県田村郡三春町"),
			wantMatchLevel:     model.MatchLevelCity,
			wantMatchedAddress: "福島県田村郡三春町",
			wantStructured: map[string]any{
				FieldPref:   "福島県",
				FieldCounty: "田村郡",
				FieldCity:   "三春町",
			},
		},
		{
			// 市川三郷町 used to stop at the prefecture.
			name:               "issue341-2 [山梨県西八代郡市川三郷町] kanji numeral in county and town",
			query:              query("山梨県西八代郡市川三郷町"),
			wantMatchLevel:     model.MatchLevelCity,
			wantMatchedAddress: "山梨県西八代郡市川三郷町",
			wantStructured: map[string]any{
				FieldPref:   "山梨県",
				FieldCounty: "西八代郡",
				FieldCity:   "市川三郷町",
			},
		},
		{
			// The town after the municipality must keep resolving. 岩下1 is
			// not a registered parcel, so the number stays unmatched.
			name:                 "issue341-3 [山梨県西八代郡市川三郷町岩下1番地] town after the municipality",
			query:                query("山梨県西八代郡市川三郷町岩下1番地"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "山梨県西八代郡市川三郷町岩下",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "山梨県",
				FieldCounty:  "西八代郡",
				FieldCity:    "市川三郷町",
				FieldOazaCho: "岩下",
			},
		},
	})
}

package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue409 covers addresses ending in 無番地, which states that the place
// has no lot number.
// The address matches as it does without 無番地, which is left in
// unmatched_address, while machiaza that carry 無番地 in their name still
// match as a whole.
// Issue #409: 新ABRで特殊住所（字住所・無番地住所）の認識精度が低下する
// https://github.com/digital-go-jp/abr-geocoder/issues/409
func TestIssue409(t *testing.T) {
	type testCase struct {
		name           string
		address        string
		wantLevel      model.MatchLevel
		wantMatched    string
		wantUnmatched  []string
		wantStructured map[string]any
	}
	kudacchi := map[string]any{
		FieldPref:    "東京都",
		FieldCity:    "大島町",
		FieldOazaCho: "差木地",
		FieldKoaza:   "字クダッチ",
	}
	cases := []testCase{
		{
			name:           "koaza followed by 無番地",
			address:        "東京都大島町差木地字クダッチ無番地",
			wantLevel:      model.MatchLevelMachiazaDetail,
			wantMatched:    "東京都大島町差木地字クダッチ",
			wantUnmatched:  []string{"無番地"},
			wantStructured: kudacchi,
		},
		{
			// lg_code=133825 machiaza_id=0000000 stands for the whole village.
			name:           "village followed by 無番地",
			address:        "東京都御蔵島村無番地",
			wantLevel:      model.MatchLevelMachiaza,
			wantMatched:    "東京都御蔵島村",
			wantUnmatched:  []string{"無番地"},
			wantStructured: map[string]any{FieldCity: "御蔵島村", FieldOazaCho: nil},
		},
		{
			// lg_code=134023 machiaza_id=0005000 is named 無番地.
			name:           "machiaza named 無番地",
			address:        "東京都青ヶ島村無番地",
			wantLevel:      model.MatchLevelMachiaza,
			wantMatched:    "東京都青ヶ島村無番地",
			wantStructured: map[string]any{FieldCity: "青ヶ島村", FieldOazaCho: "無番地"},
		},
		{
			// lg_code=234273 machiaza_id=0019115 is the koaza 無番地.
			name:           "koaza named 無番地",
			address:        "愛知県海部郡飛島村大字政成新田無番地",
			wantLevel:      model.MatchLevelMachiazaDetail,
			wantMatched:    "愛知県海部郡飛島村大字政成新田無番地",
			wantStructured: map[string]any{FieldOazaCho: "大字政成新田", FieldKoaza: "無番地"},
		},
		{
			// lg_code=122076 machiaza_id=0129000 is named 岩瀬無番地, apart from 岩瀬.
			name:           "machiaza named 無番地 before a building name",
			address:        "千葉県松戸市岩瀬無番地 集会所",
			wantLevel:      model.MatchLevelMachiaza,
			wantMatched:    "千葉県松戸市岩瀬無番地",
			wantUnmatched:  []string{"集会所"},
			wantStructured: map[string]any{FieldCity: "松戸市", FieldOazaCho: "岩瀬無番地"},
		},
		{
			name:           "無番地 before a building name",
			address:        "東京都大島町差木地字クダッチ無番地 集会所",
			wantLevel:      model.MatchLevelMachiazaDetail,
			wantMatched:    "東京都大島町差木地字クダッチ",
			wantUnmatched:  []string{"無番地", "集会所"},
			wantStructured: kudacchi,
		},
		{
			// A misspelled koaza stops at the oaza, as it does without 無番地.
			name:           "misspelled koaza followed by 無番地",
			address:        "東京都大島町差木地字クダツチ無番地",
			wantLevel:      model.MatchLevelMachiaza,
			wantMatched:    "東京都大島町差木地",
			wantUnmatched:  []string{"クダツチ", "無番地"},
			wantStructured: map[string]any{FieldOazaCho: "差木地", FieldKoaza: nil},
		},
		{
			name:          "ward-only address followed by 無番地",
			address:       "中区本町無番地",
			wantLevel:     model.MatchLevelMachiaza,
			wantMatched:   "神奈川県横浜市中区本町",
			wantUnmatched: []string{"無番地"},
			wantStructured: map[string]any{
				FieldCity:    "横浜市",
				FieldWard:    "中区",
				FieldOazaCho: "本町",
			},
		},
	}

	var tests []normalizeTestCase
	for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
		for _, c := range cases {
			tests = append(tests, normalizeTestCase{
				name: "issue409 [" + c.address + "] " + c.name + " " + string(category),
				query: model.MatchQuery{
					Address:  c.address,
					Category: category,
					Pref:     "all",
					Limit:    1,
				},
				wantMatchLevel:       c.wantLevel,
				wantMatchedAddress:   c.wantMatched,
				wantUnmatchedAddress: c.wantUnmatched,
				wantStructured:       c.wantStructured,
			})
		}
	}
	runNormalizeTests(t, tests)
}

// TestIssue409BuildingName covers 無番地 inside a building name, which is part
// of that name and stays in unmatched_address as written.
func TestIssue409BuildingName(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue409 [東京都千代田区丸の内1-1-1 コーポ無番地] building name",
			query: model.MatchQuery{
				Address:  "東京都千代田区丸の内1-1-1 コーポ無番地",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都千代田区丸の内一丁目",
			wantUnmatchedAddress: []string{"1-1", "コーポ無番地"},
		},
	})
}

package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue299 covers ward-only addresses whose city name changes shape under
// text transformation (kanji numerals become Arabic digits, hiragana becomes
// katakana). Ward expansion has to happen before that transformation so the
// prepended city name reaches the matching column in the same shape as the data.
// https://github.com/digital-go-jp/abr-geocoder/issues/299
func TestIssue299(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 北九州市八幡西区 -> 北9州市8幡西区
			name: "issue299-1 [八幡西区光明1丁目] kanji numerals in city and ward",
			query: model.MatchQuery{
				Address:  "八幡西区光明1丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "福岡県北九州市八幡西区光明一丁目",
			wantStructured: map[string]any{
				FieldPref:    "福岡県",
				FieldCity:    "北九州市",
				FieldWard:    "八幡西区",
				FieldOazaCho: "光明",
			},
		},
		{
			// さいたま市大宮区 -> サイタマ市大宮区
			name: "issue299-2 [大宮区高鼻町1丁目] hiragana city name",
			query: model.MatchQuery{
				Address:  "大宮区高鼻町1丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "埼玉県さいたま市大宮区高鼻町1丁目",
			wantStructured: map[string]any{
				FieldPref:    "埼玉県",
				FieldCity:    "さいたま市",
				FieldWard:    "大宮区",
				FieldOazaCho: "高鼻町",
			},
		},
		{
			// A ward name unaffected by the transformation must keep working.
			name: "issue299-3 [葵区追手町] unaffected ward",
			query: model.MatchQuery{
				Address:  "葵区追手町",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "静岡県静岡市葵区追手町",
		},
	})
}

package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue301 covers ward-only addresses that need more than an exact machiaza
// lookup. The expanded address goes through the whole matching path, so koaza
// completion applies and a city-level result is returned when no machiaza fits.
// https://github.com/digital-go-jp/abr-geocoder/issues/301
func TestIssue301(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			// 大倉 alone is not a machiaza; 大倉字南 is.
			name: "issue301-1 [青葉区大倉] koaza completion",
			query: model.MatchQuery{
				Address:  "青葉区大倉",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "宮城県仙台市青葉区大倉字南",
			wantStructured: map[string]any{
				FieldPref: "宮城県",
				FieldCity: "仙台市",
				FieldWard: "青葉区",
			},
		},
		{
			name: "issue301-2 [泉区上谷刈] koaza completion",
			query: model.MatchQuery{
				Address:  "泉区上谷刈",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "宮城県仙台市泉区上谷刈字原",
			wantStructured: map[string]any{
				FieldPref: "宮城県",
				FieldCity: "仙台市",
				FieldWard: "泉区",
			},
		},
		{
			// 旗立 reaches no machiaza, so the city-level result stands.
			name: "issue301-3 [太白区旗立] city-level result",
			query: model.MatchQuery{
				Address:  "太白区旗立",
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "宮城県仙台市太白区",
			wantUnmatchedAddress: []string{"旗立"},
			wantStructured: map[string]any{
				FieldPref: "宮城県",
				FieldCity: "仙台市",
				FieldWard: "太白区",
			},
		},
	})
}

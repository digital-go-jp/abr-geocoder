package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue257 covers legacy address notation wrapped in an opening parenthesis
// that is never closed. The trailing text matches no machiaza, so the city-level
// result stands and the whole parenthesized part stays unmatched. A hang here
// fails the test by exhausting the test binary timeout.
// https://github.com/digital-go-jp/abr-geocoder/issues/257
func TestIssue257(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue257-1 [江東区（旧住所] unclosed parenthesis",
			query: model.MatchQuery{
				Address:  "東京都江東区（東京府南葛飾郡大島町大字中之郷出村３６番地",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "東京都江東区",
			wantUnmatchedAddress: []string{"(東京府南葛飾郡大島町大字中之郷出村36番地"},
			wantStructured: map[string]any{
				FieldPref: "東京都",
				FieldCity: "江東区",
			},
		},
		{
			name: "issue257-2 [江東区（旧住所）] closed parenthesis",
			query: model.MatchQuery{
				Address:  "東京都江東区（東京府南葛飾郡大島町大字中之郷出村３６番地）",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "東京都江東区",
			wantUnmatchedAddress: []string{"(東京府南葛飾郡大島町大字中之郷出村36番地)"},
			wantStructured: map[string]any{
				FieldPref: "東京都",
				FieldCity: "江東区",
			},
		},
		{
			name: "issue257-3 [江東区（（（旧住所] repeated opening parentheses",
			query: model.MatchQuery{
				Address:  "東京都江東区（（（東京府南葛飾郡大島町大字中之郷出村３６番地",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantMatchedAddress:   "東京都江東区",
			wantUnmatchedAddress: []string{"(", "(", "(東京府南葛飾郡大島町大字中之郷出村36番地"},
			wantStructured: map[string]any{
				FieldPref: "東京都",
				FieldCity: "江東区",
			},
		},
		{
			// A normal address in the same city must keep matching past city level.
			name: "issue257-4 [江東区亀戸2-22-17] unaffected address",
			query: model.MatchQuery{
				Address:  "東京都江東区亀戸2-22-17",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都江東区亀戸2丁目",
			wantUnmatchedAddress: []string{"22-17"},
			wantStructured: map[string]any{
				FieldOazaCho: "亀戸",
				FieldChome:   "2丁目",
			},
		},
	})
}

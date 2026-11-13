package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue407 covers a misspelled town followed by a chome the town does not
// have.
// The chome makes another town with that chome look closer
// (日本橋小綱町1丁目 is nearer 日本橋堀留町1丁目 than 日本橋小網町), so the town whose
// name agrees with the input is taken over it.
// Issue #407: 新ABRで町名の表記揺れ補正が行われず町字認識失敗
// https://github.com/digital-go-jp/abr-geocoder/issues/407
func TestIssue407(t *testing.T) {
	var tests []normalizeTestCase
	for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
		tests = append(tests, normalizeTestCase{
			// lg_code=131024 machiaza_id=0031000 is 日本橋小網町, which has no chome.
			name: "issue407-2 [東京都中央区日本橋小綱町一丁目１番地] misspelled town with a chome it lacks " + string(category),
			query: model.MatchQuery{
				Address:  "東京都中央区日本橋小綱町一丁目１番地",
				Category: category,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都中央区日本橋小網町",
			wantUnmatchedAddress: []string{"1-1"},
			wantStructured:       map[string]any{FieldOazaCho: "日本橋小網町", FieldChome: nil},
		})
	}
	runNormalizeTests(t, tests)
}

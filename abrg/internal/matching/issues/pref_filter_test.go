package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestPrefFilter tests that a pref given in the query limits the results to
// that prefecture, including when the city in the address is elsewhere and
// the town is found by fuzzy matching.
func TestPrefFilter(t *testing.T) {
	var tests []normalizeTestCase
	for _, c := range []struct {
		name, address, pref, wantPref string
	}{
		{"city in another pref", "千代田区丸の内一丁目", "14", "神奈川県"},
		{"misspelled town in another pref", "千代田区丸ノ内一丁目", "14", "神奈川県"},
		{"pref name of another pref", "東京都千代田区丸の内一丁目", "14", "神奈川県"},
		{"designated city in another pref", "横浜市中区山下町", "13", "東京都"},
	} {
		for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
			tests = append(tests, normalizeTestCase{
				name: c.name + " " + string(category),
				query: model.MatchQuery{
					Address:  c.address,
					Category: category,
					Pref:     c.pref,
					Limit:    1,
				},
				wantMatchLevel:       model.MatchLevelPrefecture,
				wantMatchedAddress:   c.wantPref,
				wantUnmatchedAddress: []string{c.address},
				wantStructured:       map[string]any{FieldPref: c.wantPref, FieldCity: nil},
			})
		}
	}
	tests = append(tests, normalizeTestCase{
		name: "town in the given pref",
		query: model.MatchQuery{
			Address:  "千代田区丸ノ内一丁目",
			Category: model.CategoryBasic,
			Pref:     "13",
			Limit:    1,
		},
		wantMatchLevel:     model.MatchLevelMachiazaDetail,
		wantMatchedAddress: "東京都千代田区丸の内一丁目",
		wantStructured:     map[string]any{FieldPref: "東京都", FieldCity: "千代田区"},
	})
	// With no pref given, a city written after the wrong prefecture name is
	// still matched in its own prefecture.
	tests = append(tests, normalizeTestCase{
		name: "wrong pref name without pref",
		query: model.MatchQuery{
			Address:  "東京都横浜市中区山下町",
			Category: model.CategoryBasic,
			Pref:     model.All,
			Limit:    1,
		},
		wantMatchLevel:     model.MatchLevelMachiaza,
		wantMatchedAddress: "神奈川県横浜市中区山下町",
		wantStructured:     map[string]any{FieldPref: "神奈川県", FieldCity: "横浜市"},
	})
	runNormalizeTests(t, tests)
}

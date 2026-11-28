package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue349 covers two cities whose names normalize to the same string:
// 鹿嶋市 (lg_code=082228, 茨城県) and 鹿島市 (lg_code=412074, 佐賀県).
// A city name written alone is matched to the city spelled as written.
// Issue #349: 正規化で同じ名前になる鹿嶋市と鹿島市を市名だけでは区別できない
// https://github.com/digital-go-jp/abr-geocoder/issues/349
func TestIssue349(t *testing.T) {
	cases := []struct {
		address string
		pref    string
		city    string
	}{
		{"鹿嶋市", "茨城県", "鹿嶋市"},
		{"鹿島市", "佐賀県", "鹿島市"},
	}

	var tests []normalizeTestCase
	for _, c := range cases {
		for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
			tests = append(tests, normalizeTestCase{
				name: "issue349 [" + c.address + "] city spelled as written " + string(category),
				query: model.MatchQuery{
					Address:  c.address,
					Category: category,
					Pref:     "all",
					Limit:    1,
				},
				wantMatchLevel:       model.MatchLevelCity,
				wantMatchedAddress:   c.pref + c.city,
				wantUnmatchedAddress: nil,
			})
		}
	}
	runNormalizeTests(t, tests)
}

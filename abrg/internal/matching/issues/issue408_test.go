package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue408 covers a misspelled city followed by a town that matches
// exactly under the city the name is corrected to.
// category=basic finds the town there, as category=all does.
// Issue #408: 新ABRで漢数字を含む町字解決に失敗し郵便番号取得できない
// https://github.com/digital-go-jp/abr-geocoder/issues/408
func TestIssue408(t *testing.T) {
	var tests []normalizeTestCase
	for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
		tests = append(tests, normalizeTestCase{
			// lg_code=014524 machiaza_id=0001106 is 10線3号 in 鷹栖町, which
			// the input writes as 鷹栖村.
			name: "issue408-1 [北海道上川郡鷹栖村十線三号] city misspelled " + string(category),
			query: model.MatchQuery{
				Address:  "北海道上川郡鷹栖村十線三号",
				Category: category,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "北海道上川郡鷹栖町10線3号",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldCity: "鷹栖町", FieldOazaCho: "10線", FieldKoaza: "3号"},
		})
	}
	runNormalizeTests(t, tests)
}

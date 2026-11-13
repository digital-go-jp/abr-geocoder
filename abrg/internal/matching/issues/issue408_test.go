package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue408 covers a city named in a way that the town does not match under
// as written: a misspelled city, and a designated city whose ward is left out.
// The town is found under the corrected city and under the ward that has it.
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
	for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
		tests = append(tests, normalizeTestCase{
			// lg_code=431036 machiaza_id=0009001 is 上熊本1丁目 in 熊本市西区,
			// and the input leaves the ward out.
			name: "issue408-2 [熊本市上熊本一丁目２番６号] ward left out " + string(category),
			query: model.MatchQuery{
				Address:  "熊本市上熊本一丁目２番６号",
				Category: category,
				Pref:     "all",
				Limit:    1,
			},
			wantUnmatchedAddress: []string{},
			wantStructured: map[string]any{
				FieldPref:    "熊本県",
				FieldCity:    "熊本市",
				FieldWard:    "西区",
				FieldOazaCho: "上熊本",
				FieldChome:   "1丁目",
			},
		})
	}
	tests = append(tests, normalizeTestCase{
		// 新栄3丁目 is in 千種区, 中区 and 東区 of 名古屋市.
		name: "issue408-3 [名古屋市新栄三丁目] town in several wards",
		query: model.MatchQuery{
			Address:  "名古屋市新栄三丁目",
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		},
		wantMatchLevel:       model.MatchLevelCity,
		wantMatchedAddress:   "愛知県名古屋市",
		wantUnmatchedAddress: []string{"新栄三丁目"},
	})
	runNormalizeTests(t, tests)
}

package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue364 covers a town or village written after the prefecture
// without its county (郡).
// It matches the town or village, not a city with a similar name.
// Issue #364: 郡を省いた町村名が市区町村に届かず、同名の市がある6件は誤マッチする
// https://github.com/digital-go-jp/abr-geocoder/issues/364
func TestIssue364(t *testing.T) {
	cases := []struct {
		address string
		county  string
		city    string
	}{
		{"宮城県涌谷町", "遠田郡", "涌谷町"},
		{"三重県多気町", "多気郡", "多気町"},
		{"北海道滝上町", "紋別郡", "滝上町"},
		// The six below have a city of a similar name.
		{"北海道釧路町", "釧路郡", "釧路町"},
		{"広島県府中町", "安芸郡", "府中町"},
		{"福井県越前町", "丹生郡", "越前町"},
		{"高知県四万十町", "高岡郡", "四万十町"},
		{"高知県土佐町", "土佐郡", "土佐町"},
		{"長野県佐久穂町", "南佐久郡", "佐久穂町"},
	}

	var tests []normalizeTestCase
	for _, c := range cases {
		tests = append(tests, normalizeTestCase{
			name: "issue364 [" + c.address + "] county left out",
			query: model.MatchQuery{
				Address:  c.address,
				Category: model.CategoryAll,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelCity,
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldCounty: c.county, FieldCity: c.city, FieldOazaCho: nil},
		})
	}
	tests = append(tests, normalizeTestCase{
		// lg_code=045012 machiaza_id=0037000 is 字本町 in 遠田郡涌谷町.
		name: "issue364 [宮城県涌谷町字本町] town after the county left out",
		query: model.MatchQuery{
			Address:  "宮城県涌谷町字本町",
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		},
		wantMatchLevel:       model.MatchLevelMachiaza,
		wantMatchedAddress:   "宮城県遠田郡涌谷町字本町",
		wantUnmatchedAddress: nil,
	})
	runNormalizeTests(t, tests)
}

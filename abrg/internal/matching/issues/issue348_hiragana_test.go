package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue348Hiragana covers the iroha parcel prefixes that some
// municipalities record in hiragana rather than katakana.
// https://github.com/digital-go-jp/abr-geocoder/issues/348
func TestIssue348Hiragana(t *testing.T) {
	query := func(address string) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: model.CategoryAll,
			Pref:     "all",
			Limit:    1,
		}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			// 朝日町 records its iroha prefixes in hiragana, while the search
			// address has had its hiragana turned into katakana.
			name:               "issue348-hiragana [山形県西村山郡朝日町大字常盤い9番地] hiragana prefix",
			query:              query("山形県西村山郡朝日町大字常盤い9番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "山形県西村山郡朝日町大字常盤い9",
			wantStructured: map[string]any{
				FieldPref:    "山形県",
				FieldCounty:  "西村山郡",
				FieldCity:    "朝日町",
				FieldOazaCho: "大字常盤",
				FieldPrcNum1: "い9",
			},
		},
	})
}

package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue347 covers two municipalities whose names differ only by a variant
// character: 鹿嶋市 (茨城県) and 鹿島市 (佐賀県) both normalize to 鹿島市. The
// city-to-prefecture lookup cannot say which one a prefecture-less address
// means, so it must not answer with either.
// https://github.com/digital-go-jp/abr-geocoder/issues/347
func TestIssue347(t *testing.T) {
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
			name:               "issue347-1 [鹿嶋市宮中1丁目1番1号] no prefecture, 茨城県 side",
			query:              query("鹿嶋市宮中1丁目1番1号"),
			wantMatchLevel:     model.MatchLevelResidentialDetail,
			wantMatchedAddress: "茨城県鹿嶋市宮中1丁目1-1",
			wantStructured: map[string]any{
				FieldPref:    "茨城県",
				FieldCity:    "鹿嶋市",
				FieldOazaCho: "宮中",
			},
		},
		{
			// 大字高津原1 is not a registered parcel, so the number stays unmatched.
			name:                 "issue347-2 [鹿島市高津原1番地] no prefecture, 佐賀県 side",
			query:                query("鹿島市高津原1番地"),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "佐賀県鹿島市大字高津原",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "佐賀県",
				FieldCity:    "鹿島市",
				FieldOazaCho: "大字高津原",
			},
		},
	})
}

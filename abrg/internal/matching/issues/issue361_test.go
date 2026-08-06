package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue361 covers the machiaza a parcel number is answered under when the
// one the address names holds no parcels of its own.
// Issue #361: 地番を持たない小字に、基底町字の地番が付いて返る
// https://github.com/digital-go-jp/abr-geocoder/issues/361
func TestIssue361(t *testing.T) {
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
			// 大字南長野字県町 (lg_code=202011 machiaza_id=0231136) holds no
			// parcels. 477-1 belongs to the base 大字南長野 (0231000), which
			// covers several koaza, so the number cannot be placed in 字県町.
			name:                 "issue361-1 [長野県長野市大字南長野県町477-1] koaza without parcels",
			query:                query("長野県長野市大字南長野県町477-1"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "長野県長野市大字南長野県町",
			wantUnmatchedAddress: []string{"477-1"},
			wantStructured: map[string]any{
				FieldPref:    "長野県",
				FieldCity:    "長野市",
				FieldOazaCho: "大字南長野",
				FieldKoaza:   "県町",
				FieldPrcNum1: nil,
				FieldPrcNum2: nil,
			},
		},
		{
			// The same number under the town that does hold it.
			name:                 "issue361-2 [長野県長野市大字南長野477-1] base town keeps its parcel",
			query:                query("長野県長野市大字南長野477-1"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "長野県長野市大字南長野477-1",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "長野県",
				FieldCity:    "長野市",
				FieldOazaCho: "大字南長野",
				FieldKoaza:   nil,
				FieldPrcNum1: "477",
				FieldPrcNum2: "1",
			},
		},
		{
			// A Kyoto street name is another way of writing the same town, and
			// ABR files the parcels under the town rather than the street, so
			// the number still has to come back.
			name:                 "issue361-3 [京都府京都市中京区寺町通御池上る上本能寺前町488番地] kyoto street name",
			query:                query("京都府京都市中京区寺町通御池上る上本能寺前町488番地"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "京都府京都市中京区寺町通御池上る上本能寺前町488",
			wantUnmatchedAddress: nil,
			wantStructured: map[string]any{
				FieldPref:    "京都府",
				FieldCity:    "京都市",
				FieldWard:    "中京区",
				FieldKyotoSt: "寺町通御池上る",
				FieldOazaCho: "上本能寺前町",
				FieldPrcNum1: "488",
			},
		},
	})
}

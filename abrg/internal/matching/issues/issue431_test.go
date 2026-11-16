package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue431 covers a lot number written after a koaza of an oaza that has
// chomes.
// No chome follows a koaza, so the first number is not taken as one.
// Issue #431: 小字の後ろの地番 N-M が地番 M として返る
// https://github.com/digital-go-jp/abr-geocoder/issues/431
func TestIssue431(t *testing.T) {
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
			// lg_code=232017 machiaza_id=0102112 (下地町字四ッ屋) holds both 80-9 and 9.
			name:                 "issue431-1 [愛知県豊橋市下地町字四ッ屋８０番地の９]",
			query:                query("愛知県豊橋市下地町字四ッ屋８０番地の９"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "愛知県豊橋市下地町字四ッ屋80-9",
			wantUnmatchedAddress: nil,
		},
		{
			// lg_code=172014 machiaza_id=0549118 (若松町ツ) holds 92-2.
			name:                 "issue431-2 [石川県金沢市若松町ツ９２番地２]",
			query:                query("石川県金沢市若松町ツ９２番地２"),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "石川県金沢市若松町ツ92-2",
			wantUnmatchedAddress: nil,
		},
		{
			// lg_code=032018 machiaza_id=0003104 (浅岸字貝田) has no lot 30-7, so
			// the number stays unmatched rather than becoming lot 7.
			name:                 "issue431-3 [岩手県盛岡市浅岸字貝田３０番地７]",
			query:                query("岩手県盛岡市浅岸字貝田３０番地７"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "岩手県盛岡市浅岸字貝田",
			wantUnmatchedAddress: []string{"30-7"},
		},
	})
}

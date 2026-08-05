package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue340 covers wards whose name changes under normalization: 千種区
// becomes 1000種区, 住之江区 becomes 住ノ江区 and 保土ケ谷区 becomes 保土ガ谷区.
// The lookups built when the cache is opened are searched with normalized text,
// so they have to be keyed by the normalized names as well.
// https://github.com/digital-go-jp/abr-geocoder/issues/340
func TestIssue340(t *testing.T) {
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
			name:               "issue340-1 [愛知県名古屋市千種区] ward only",
			query:              query("愛知県名古屋市千種区"),
			wantMatchLevel:     model.MatchLevelCity,
			wantMatchedAddress: "愛知県名古屋市千種区",
			wantStructured: map[string]any{
				FieldPref: "愛知県",
				FieldCity: "名古屋市",
				FieldWard: "千種区",
			},
		},
		{
			name:               "issue340-2 [大阪府大阪市住之江区] ward only",
			query:              query("大阪府大阪市住之江区"),
			wantMatchLevel:     model.MatchLevelCity,
			wantMatchedAddress: "大阪府大阪市住之江区",
			wantStructured: map[string]any{
				FieldPref: "大阪府",
				FieldCity: "大阪市",
				FieldWard: "住之江区",
			},
		},
		{
			// ケ and ヶ both reach the ward registered as 保土ケ谷区.
			name:               "issue340-3 [神奈川県横浜市保土ヶ谷区] ward only",
			query:              query("神奈川県横浜市保土ヶ谷区"),
			wantMatchLevel:     model.MatchLevelCity,
			wantMatchedAddress: "神奈川県横浜市保土ケ谷区",
			wantStructured: map[string]any{
				FieldPref: "神奈川県",
				FieldCity: "横浜市",
				FieldWard: "保土ケ谷区",
			},
		},
		{
			// An address naming no city is resolved by looking the ward up on
			// its own, which needs the same normalized name.
			name:               "issue340-4 [保土ヶ谷区川辺町1番地] no city before the ward",
			query:              query("保土ヶ谷区川辺町1番地"),
			wantMatchLevel:     model.MatchLevelMachiaza,
			wantMatchedAddress: "神奈川県横浜市保土ケ谷区川辺町",
			// 川辺町1 is not a registered parcel, so the number stays unmatched.
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "神奈川県",
				FieldCity:    "横浜市",
				FieldWard:    "保土ケ谷区",
				FieldOazaCho: "川辺町",
			},
		},
		{
			name:               "issue340-5 [千種区神田町18番地] no city before the ward",
			query:              query("千種区神田町18番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "愛知県名古屋市千種区神田町18",
			wantStructured: map[string]any{
				FieldPref:    "愛知県",
				FieldCity:    "名古屋市",
				FieldWard:    "千種区",
				FieldOazaCho: "神田町",
				FieldPrcNum1: "18",
			},
		},
		{
			// 神田町 has no chome. The town still has to be found, rather than
			// the search settling on 花田町一丁目, which is a closer edit
			// distance to the input but a different town.
			name:               "issue340-6 [愛知県名古屋市千種区神田町一丁目18番地] chome the town does not have",
			query:              query("愛知県名古屋市千種区神田町一丁目18番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "愛知県名古屋市千種区神田町18",
			wantStructured: map[string]any{
				FieldPref:    "愛知県",
				FieldCity:    "名古屋市",
				FieldWard:    "千種区",
				FieldOazaCho: "神田町",
				FieldPrcNum1: "18",
			},
		},
		{
			// 大字 is stripped from the search address but kept in oaza_cho, so
			// both forms of the name have to be compared against the input.
			name:                 "issue340-7 [愛知県名古屋市千種区猪高町大字猪子石原1190番地] 大字 in the town name",
			query:                query("愛知県名古屋市千種区猪高町大字猪子石原1190番地"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛知県名古屋市千種区猪高町大字猪子石原字太田",
			wantUnmatchedAddress: []string{"1190"},
			wantStructured: map[string]any{
				FieldPref:    "愛知県",
				FieldCity:    "名古屋市",
				FieldWard:    "千種区",
				FieldOazaCho: "猪高町大字猪子石原",
			},
		},
		{
			// 大宇 is a common misspelling of 大字, and the town it names is
			// still the one registered as 大字向町.
			name:               "issue340-8 [山形県最上郡最上町大宇向町774番地の9] 大字 misspelled",
			query:              query("山形県最上郡最上町大宇向町774番地の9"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "山形県最上郡最上町大字向町774-9",
			wantStructured: map[string]any{
				FieldPref:    "山形県",
				FieldCounty:  "最上郡",
				FieldCity:    "最上町",
				FieldOazaCho: "大字向町",
			},
		},
	})
}

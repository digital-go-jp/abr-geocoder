package issues

import (
	"testing"

	"abrg/internal/model"
)

// TestIssue343 covers place names that contain 万 or 億. Those characters are
// multipliers, but on their own they belong to the name rather than to a
// number, so they must survive normalization unchanged. Whether they do must
// not depend on the rest of the address: the same name has to normalize the
// same way when it stands alone in the cache and when it sits in a full
// address next to a kanji chome.
// https://github.com/digital-go-jp/abr-geocoder/issues/343
func TestIssue343(t *testing.T) {
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
			// 万代町 must not be drawn to 八百屋町, whose name is held as
			// digits in the cache. lg_code 362018 / machiaza_id 0146003.
			name:               "issue343-1 [徳島県徳島市万代町三丁目] kanji chome after 万",
			query:              query("徳島県徳島市万代町三丁目"),
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "徳島県徳島市万代町3丁目",
			wantStructured: map[string]any{
				FieldPref:    "徳島県",
				FieldCity:    "徳島市",
				FieldOazaCho: "万代町",
				FieldChome:   "3丁目",
			},
		},
		{
			// 万年寺 must not be drawn to 千代田. lg_code 112119 /
			// machiaza_id 0003002.
			name:               "issue343-2 [埼玉県本庄市万年寺二丁目] kanji chome after 万",
			query:              query("埼玉県本庄市万年寺二丁目"),
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "埼玉県本庄市万年寺2丁目",
			wantStructured: map[string]any{
				FieldPref:    "埼玉県",
				FieldCity:    "本庄市",
				FieldOazaCho: "万年寺",
				FieldChome:   "2丁目",
			},
		},
		{
			// 万代 must not be drawn to 八千代, and the address numbers have
			// to keep reaching the residential level.
			name:               "issue343-3 [新潟県新潟市中央区万代一丁目1番1号] kanji chome after 万",
			query:              query("新潟県新潟市中央区万代一丁目1番1号"),
			wantMatchLevel:     model.MatchLevelResidentialDetail,
			wantMatchedAddress: "新潟県新潟市中央区万代1丁目1-1",
			wantStructured: map[string]any{
				FieldPref:    "新潟県",
				FieldCity:    "新潟市",
				FieldWard:    "中央区",
				FieldOazaCho: "万代",
				FieldChome:   "1丁目",
				FieldBlkNum:  "1",
				FieldRsdtNum: "1",
			},
		},
		{
			// 万願寺 carries no residential data, so the numbers stay
			// unmatched. The chome itself must still be reached.
			name:                 "issue343-4 [東京都日野市万願寺一丁目1番1号] kanji chome after 万",
			query:                query("東京都日野市万願寺一丁目1番1号"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都日野市万願寺1丁目",
			wantUnmatchedAddress: []string{"1-1"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "日野市",
				FieldOazaCho: "万願寺",
				FieldChome:   "1丁目",
			},
		},
		{
			// 一ノ坂 is not in the registry, so how far the tail reaches is
			// open. The municipality must be identified either way.
			name:                 "issue343-5 [佐賀県伊万里市大坪町一ノ坂乙4580番地2] kanji numeral after 万",
			query:                query("佐賀県伊万里市大坪町一ノ坂乙4580番地2"),
			wantUnmatchedAddress: []string{},
			wantStructured: map[string]any{
				FieldPref: "佐賀県",
				FieldCity: "伊万里市",
			},
		},
		{
			// 万 as part of a real number still converts: 四万十 is 40010 on
			// both sides, and 一条通 keeps its own conversion.
			name:               "issue343-6 [高知県四万十市中村一条通1丁目] 万 inside a number",
			query:              query("高知県四万十市中村一条通1丁目"),
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "高知県四万十市中村一条通1丁目",
			wantStructured: map[string]any{
				FieldPref:    "高知県",
				FieldCity:    "四万十市",
				FieldOazaCho: "中村一条通",
				FieldChome:   "1丁目",
			},
		},
	})
}

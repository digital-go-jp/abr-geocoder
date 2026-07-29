package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue300 covers ward names shared with a Tokyo special ward. The special
// ward pins the prefecture to 東京都, so ward expansion must still run when that
// prefecture yields no machiaza, and a candidate that reaches machiaza wins.
// https://github.com/digital-go-jp/abr-geocoder/issues/300
func TestIssue300(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue300-1 [中央区薬院1丁目] ward shared with a special ward",
			query: model.MatchQuery{
				Address:  "中央区薬院1丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "福岡県福岡市中央区薬院1丁目",
			wantStructured: map[string]any{
				FieldPref:    "福岡県",
				FieldCity:    "福岡市",
				FieldWard:    "中央区",
				FieldOazaCho: "薬院",
			},
		},
		{
			name: "issue300-2 [北区長柄東1丁目] 北区 exists in Tokyo and Osaka",
			query: model.MatchQuery{
				Address:  "北区長柄東1丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "大阪府大阪市北区長柄東1丁目",
			wantStructured: map[string]any{
				FieldPref: "大阪府",
				FieldCity: "大阪市",
				FieldWard: "北区",
			},
		},
		{
			name: "issue300-3 [港区築港1丁目] 港区 exists in Tokyo, Osaka and Nagoya",
			query: model.MatchQuery{
				Address:  "港区築港1丁目",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelMachiazaDetail,
			wantMatchedAddress: "大阪府大阪市港区築港1丁目",
			wantStructured: map[string]any{
				FieldPref: "大阪府",
				FieldCity: "大阪市",
				FieldWard: "港区",
			},
		},
		{
			// The special ward resolves on its own, so expansion must not run.
			name: "issue300-4 [中央区銀座1-1] special ward still wins",
			query: model.MatchQuery{
				Address:  "中央区銀座1-1",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "東京都中央区銀座1丁目",
			wantUnmatchedAddress: []string{"1"},
			wantStructured: map[string]any{
				FieldPref:    "東京都",
				FieldCity:    "中央区",
				FieldWard:    nil,
				FieldOazaCho: "銀座",
			},
		},
		{
			// Nothing beyond the ward: the special ward keeps the city-level result.
			name: "issue300-5 [中央区] ward name alone",
			query: model.MatchQuery{
				Address:  "中央区",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:     model.MatchLevelCity,
			wantMatchedAddress: "東京都中央区",
		},
	})
}

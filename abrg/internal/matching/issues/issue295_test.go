package issues

import (
	"abrg/internal/model"
	"testing"
)

// TestIssue295 covers chome input on machiaza whose own name ends in a numeral
// word (一番町, 二番町). The chome marker has to be consumed by the chome match
// instead of being left in the unmatched remainder, where it would be reported
// on top of the already normalized chome.
// https://github.com/digital-go-jp/abr-geocoder/issues/295
func TestIssue295(t *testing.T) {
	runNormalizeTests(t, []normalizeTestCase{
		{
			name: "issue295-1 [松山市一番町4丁目4-2] chome marker consumed",
			query: model.MatchQuery{
				Address:  "愛媛県松山市一番町4丁目4-2",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県松山市一番町四丁目",
			wantUnmatchedAddress: []string{"4-2"},
			wantStructured: map[string]any{
				FieldPref:    "愛媛県",
				FieldCity:    "松山市",
				FieldOazaCho: "一番町",
				FieldChome:   "四丁目",
			},
		},
		{
			// The data spells this chome with an Arabic numeral, unlike 松山市.
			name: "issue295-2 [仙台市青葉区一番町1丁目9-1] chome marker consumed",
			query: model.MatchQuery{
				Address:  "宮城県仙台市青葉区一番町1丁目9-1",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "宮城県仙台市青葉区一番町1丁目",
			wantUnmatchedAddress: []string{"9-1"},
			wantStructured: map[string]any{
				FieldPref:    "宮城県",
				FieldCity:    "仙台市",
				FieldWard:    "青葉区",
				FieldOazaCho: "一番町",
				FieldChome:   "1丁目",
			},
		},
		{
			name: "issue295-3 [松山市二番町4丁目1-1] chome marker consumed",
			query: model.MatchQuery{
				Address:  "愛媛県松山市二番町4丁目1-1",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県松山市二番町四丁目",
			wantUnmatchedAddress: []string{"1-1"},
			wantStructured: map[string]any{
				FieldOazaCho: "二番町",
				FieldChome:   "四丁目",
			},
		},
		{
			name: "issue295-4 [松山市一番町４丁目４－２] full-width input",
			query: model.MatchQuery{
				Address:  "愛媛県松山市一番町４丁目４－２",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県松山市一番町四丁目",
			wantUnmatchedAddress: []string{"4-2"},
			wantStructured: map[string]any{
				FieldOazaCho: "一番町",
				FieldChome:   "四丁目",
			},
		},
		{
			name: "issue295-5 [松山市一番町4丁目4番2号] ban-go notation",
			query: model.MatchQuery{
				Address:  "愛媛県松山市一番町4丁目4番2号",
				Category: model.CategoryBasic,
				Pref:     "all",
				Limit:    1,
			},
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "愛媛県松山市一番町四丁目",
			wantUnmatchedAddress: []string{"4-2"},
			wantStructured: map[string]any{
				FieldOazaCho: "一番町",
				FieldChome:   "四丁目",
			},
		},
	})
}

package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue434 covers two same-named machiaza, with and without 大字,
// that both hold parcels while the input lot exists in only one of them.
// lg_code=152226 has 富岡 (machiaza_id=0581000, 147 parcels, holds 3525) and
// 大字富岡 (machiaza_id=0239000, 4252 parcels, no 3525).
// lg_code=132241 has 貝取 (machiaza_id=0009000, holds 1459 and 1493) and
// 大字貝取 (machiaza_id=0030000, holds neither).
// lg_code=042111 has 字梶橋 (machiaza_id=0028000, holds 47-4) and
// 梶橋 (machiaza_id=0015000).
// The candidate holding the input lot is chosen.
// Issue #434: 大字の有無だけが違う同名の町字で、入力の地番を持たない側を選ぶ
// https://github.com/digital-go-jp/abr-geocoder/issues/434
func TestIssue434(t *testing.T) {
	query := func(address string, category model.Category) model.MatchQuery {
		return model.MatchQuery{
			Address:  address,
			Category: category,
			Pref:     "all",
			Limit:    1,
		}
	}

	runNormalizeTests(t, []normalizeTestCase{
		{
			name:                 "issue434-1 [新潟県上越市富岡３５２５番地] all",
			query:                query("新潟県上越市富岡３５２５番地", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "新潟県上越市富岡3525",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldOazaCho: "富岡", FieldPrcNum1: "3525"},
		},
		{
			name:                 "issue434-2 [新潟県上越市富岡３５２５番地] basic",
			query:                query("新潟県上越市富岡３５２５番地", model.CategoryBasic),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "新潟県上越市富岡",
			wantUnmatchedAddress: []string{"3525"},
			wantStructured:       map[string]any{FieldOazaCho: "富岡"},
		},
		{
			name:                 "issue434-3 [東京都多摩市貝取１４５９番地] basic",
			query:                query("東京都多摩市貝取１４５９番地", model.CategoryBasic),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都多摩市貝取",
			wantUnmatchedAddress: []string{"1459"},
			wantStructured:       map[string]any{FieldOazaCho: "貝取"},
		},
		{
			name:                 "issue434-5 [東京都多摩市貝取１４９３番地の１シャロンパーク多摩・永山５０７] basic",
			query:                query("東京都多摩市貝取１４９３番地の１シャロンパーク多摩・永山５０７", model.CategoryBasic),
			wantMatchLevel:       model.MatchLevelMachiaza,
			wantMatchedAddress:   "東京都多摩市貝取",
			wantUnmatchedAddress: []string{"1493-1シャロンパーク多摩・永山507"},
			wantStructured:       map[string]any{FieldOazaCho: "貝取"},
		},
		{
			name:                 "issue434-4 [宮城県岩沼市字梶橋４７番地の４] all",
			query:                query("宮城県岩沼市字梶橋４７番地の４", model.CategoryAll),
			wantMatchLevel:       model.MatchLevelParcel,
			wantMatchedAddress:   "宮城県岩沼市字梶橋47-4",
			wantUnmatchedAddress: nil,
			wantStructured:       map[string]any{FieldPrcNum1: "47", FieldPrcNum2: "4"},
		},
	})
}

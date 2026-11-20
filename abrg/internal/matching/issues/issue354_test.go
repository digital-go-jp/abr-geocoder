package issues

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// TestIssue354 covers a parcel number with a prefix written right after the
// town name, which matches no town as written and goes to the fuzzy search.
// The town before the prefix is taken, not another town whose name reads
// the prefix as one more character of its own.
// Issue #354: ヰ・ヱ で始まる地番が別の小字に落ちる
// https://github.com/digital-go-jp/abr-geocoder/issues/354
func TestIssue354(t *testing.T) {
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
			// lg_code=104299 machiaza_id=0021000 (大字三島) holds the parcel ヰ6697.
			name:               "issue354-1 [群馬県吾妻郡東吾妻町大字三島ヰ6697番地]",
			query:              query("群馬県吾妻郡東吾妻町大字三島ヰ6697番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "群馬県吾妻郡東吾妻町大字三島ヰ6697",
			wantStructured:     map[string]any{FieldOazaCho: "大字三島", FieldKoaza: nil, FieldPrcNum1: "ヰ6697"},
		},
		{
			// The same holds for a prefix other than ヰ and ヱ.
			name:               "issue354-2 [群馬県吾妻郡東吾妻町大字三島ニ6697番地]",
			query:              query("群馬県吾妻郡東吾妻町大字三島ニ6697番地"),
			wantMatchLevel:     model.MatchLevelParcel,
			wantMatchedAddress: "群馬県吾妻郡東吾妻町大字三島ニ6697",
			wantStructured:     map[string]any{FieldOazaCho: "大字三島", FieldKoaza: nil, FieldPrcNum1: "ニ6697"},
		},
		{
			// lg_code=172073 machiaza_id=0066125 (柳田町 ヒ) holds the parcel ヱ145-1,
			// and 14字 is another koaza of 柳田町.
			name:                 "issue354-3 [石川県羽咋市柳田町ヒヱ145番地1]",
			query:                query("石川県羽咋市柳田町ヒヱ145番地1"),
			wantMatchLevel:       model.MatchLevelMachiazaDetail,
			wantMatchedAddress:   "石川県羽咋市柳田町ヒ",
			wantUnmatchedAddress: []string{"ヱ145-1"},
			wantStructured:       map[string]any{FieldOazaCho: "柳田町", FieldKoaza: "ヒ"},
		},
	})
}

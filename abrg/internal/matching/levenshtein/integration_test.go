package levenshtein

import (
	"reflect"
	"testing"

	"abrg/internal/model"
	"abrg/internal/repository"
)

// basicCandidate builds a BasicResult whose NormalizedAddress (used for scoring)
// matches the structured place-name fields (used for the matched address string).
func basicCandidate(pref, city, oaza, normalized string) repository.BasicResult {
	return repository.BasicResult{
		Pref:              pref,
		City:              city,
		OazaCho:           &oaza,
		NormalizedAddress: normalized,
	}
}

func TestProcessResults(t *testing.T) {
	const searchAddr = "東京都千代田区丸の内"

	// Exact match: editDist 0 -> top score.
	exact := basicCandidate("東京都", "千代田区", "丸の内", "東京都千代田区丸の内")
	// Fuzzy match: extra "二丁目" -> positive editDist -> lower score.
	fuzzy := basicCandidate("東京都", "千代田区", "丸の内二丁目", "東京都千代田区丸の内二丁目")

	call := func(cands []repository.BasicResult, limit int) []model.MatchedResult {
		return processResults(cands, searchAddr, "", searchAddr, model.CategoryBasic, limit)
	}

	t.Run("sorts by score descending regardless of input order", func(t *testing.T) {
		got := call([]repository.BasicResult{fuzzy, exact}, 10)
		if len(got) != 2 {
			t.Fatalf("len = %d, want 2: %+v", len(got), got)
		}
		if got[0].MatchedAddress != "東京都千代田区丸の内" {
			t.Errorf("top result = %q, want the exact match first", got[0].MatchedAddress)
		}
		if !(got[0].Score > got[1].Score) {
			t.Errorf("scores not descending: %v then %v", got[0].Score, got[1].Score)
		}
	})

	t.Run("truncates to limit", func(t *testing.T) {
		got := call([]repository.BasicResult{exact, fuzzy}, 1)
		if len(got) != 1 {
			t.Fatalf("len = %d, want 1 (limited)", len(got))
		}
		if got[0].MatchedAddress != "東京都千代田区丸の内" {
			t.Errorf("kept %q, want the highest-scoring result", got[0].MatchedAddress)
		}
	})

	t.Run("drops basic-category @ noise when search has no number", func(t *testing.T) {
		// A chome (@) record must not surface for a plain place-name search.
		noise := basicCandidate("東京都", "千代田区", "丸の内", "東京都千代田区丸の内1@")
		got := call([]repository.BasicResult{exact, noise}, 10)
		if len(got) != 1 {
			t.Fatalf("len = %d, want 1 (@ candidate filtered): %+v", len(got), got)
		}
	})

	t.Run("empty candidates yield empty results", func(t *testing.T) {
		if got := call(nil, 10); len(got) != 0 {
			t.Errorf("len = %d, want 0", len(got))
		}
	})
}

func TestExtractUnmatchedAddress(t *testing.T) {
	t.Run("search number that is a place name is fully matched (nil)", func(t *testing.T) {
		// koaza "三五十" normalizes to "3510"; the search number is the koaza itself.
		// Without the place-name check the trailing "3510" in searchAddr would leak
		// out as an unmatched part, so this pins the place-name branch specifically.
		addr := &model.StructuredAddress{Koaza: new("三五十")}
		got := extractUnmatchedAddress("3510", addr, model.CategoryBasic, "A市3510", "A市三五十", "A市三五十")
		if got != nil {
			t.Errorf("got %v, want nil (searchNumbers is the koaza place name)", got)
		}
	})

	t.Run("non-numeric suffix belonging to koaza is fully matched (nil)", func(t *testing.T) {
		addr := &model.StructuredAddress{Koaza: new("壱弐号ヤドミ")}
		const full = "X市壱弐号ヤドミ"
		got := extractUnmatchedAddress("ヤドミ", addr, model.CategoryBasic, full, full, full)
		if got != nil {
			t.Errorf("got %v, want nil (ヤドミ is the koaza suffix)", got)
		}
	})

	t.Run("no search number returns the standardized remainder", func(t *testing.T) {
		const norm = "香川県丸亀市原田町字東三分一1926-1"
		const matched = "香川県丸亀市原田町"
		addr := &model.StructuredAddress{} // no koaza
		got := extractUnmatchedAddress("", addr, model.CategoryBasic, norm, norm, matched)
		want := []string{"東三分一1926-1"}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("got %v, want %v", got, want)
		}
	})

	t.Run("no search number and koaza fully matched leaves nothing (nil)", func(t *testing.T) {
		const full = "X市Y町字Z"
		addr := &model.StructuredAddress{Koaza: new("字Z")}
		got := extractUnmatchedAddress("", addr, model.CategoryBasic, full, full, full)
		if got != nil {
			t.Errorf("got %v, want nil (address fully matched)", got)
		}
	})
}

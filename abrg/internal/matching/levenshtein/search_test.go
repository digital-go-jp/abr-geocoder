package levenshtein

import (
	"context"
	"testing"

	"abrg/internal/model"
	"abrg/internal/repository"
)

// stubCityQuerier returns a fixed city result for FindCityByAddress.
type stubCityQuerier struct {
	city      *repository.CityResult
	gotParams repository.CitySearchParams
}

func (s *stubCityQuerier) FindBasicByLevenshtein(_ context.Context, _ repository.LevenshteinParams) ([]repository.BasicResult, error) {
	return nil, nil
}

func (s *stubCityQuerier) FindBasicByPrefix(_ context.Context, _ repository.PrefixParams) ([]repository.BasicResult, error) {
	return nil, nil
}

func (s *stubCityQuerier) FindCityByAddress(_ context.Context, params repository.CitySearchParams) (*repository.CityResult, error) {
	s.gotParams = params
	return s.city, nil
}

// A detected prefecture code must be forwarded to the city fallback query so that
// same-named cities in different prefectures (e.g. 東京都府中市 vs 広島県府中市) are
// disambiguated. Regression test for issue #242.
func TestTryFallbackCitySearchByScore_ForwardsPrefCode(t *testing.T) {
	repo := &stubCityQuerier{city: &repository.CityResult{
		LgCode: "342084",
		Pref:   "広島県",
		City:   "府中市",
	}}

	_, err := tryFallbackCitySearchByScore(context.Background(), repo, SearchParams{
		Category:         model.CategoryAll,
		StandardizedAddr: "府中市上下町甲148番地",
		SearchAddr:       "府中市上下町甲148番地",
		Pref:             "34",
		Limit:            1,
	})
	if err != nil {
		t.Fatalf("tryFallbackCitySearchByScore() error = %v", err)
	}
	if repo.gotParams.PrefCode != "34" {
		t.Errorf("FindCityByAddress PrefCode = %q, want %q", repo.gotParams.PrefCode, "34")
	}
}

// A fully matched city-level input must yield nil UnmatchedAddress (JSON null),
// never an empty non-nil slice (JSON []). See model.MatchedResult.UnmatchedAddress.
func TestTryFallbackCitySearchByScore_FullMatchYieldsNilUnmatched(t *testing.T) {
	repo := &stubCityQuerier{city: &repository.CityResult{
		LgCode: "342025",
		Pref:   "広島県",
		City:   "福山市",
	}}

	results, err := tryFallbackCitySearchByScore(context.Background(), repo, SearchParams{
		Category:         model.CategoryAll,
		StandardizedAddr: "福山市",
		SearchAddr:       "福山市",
		Limit:            1,
	})
	if err != nil {
		t.Fatalf("tryFallbackCitySearchByScore() error = %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("len(results) = %d, want 1", len(results))
	}
	if results[0].UnmatchedAddress != nil {
		t.Errorf("UnmatchedAddress = %#v, want nil", results[0].UnmatchedAddress)
	}
}

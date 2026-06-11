package levenshtein

import (
	"context"
	"testing"

	"abrg/internal/model"
	"abrg/internal/repository"
)

// stubCityQuerier returns a fixed city result for FindCityByAddress.
type stubCityQuerier struct {
	city *repository.CityResult
}

func (s *stubCityQuerier) FindBasicByLevenshtein(_ context.Context, _ repository.LevenshteinParams) ([]repository.BasicResult, error) {
	return nil, nil
}

func (s *stubCityQuerier) FindBasicByPrefix(_ context.Context, _ repository.PrefixParams) ([]repository.BasicResult, error) {
	return nil, nil
}

func (s *stubCityQuerier) FindCityByAddress(_ context.Context, _ repository.CitySearchParams) (*repository.CityResult, error) {
	return s.city, nil
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

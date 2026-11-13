package levenshtein

import (
	"context"
	"errors"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/repository"
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

func (s *stubCityQuerier) FindCandidateLgCodes(_ context.Context, _ repository.CityFuzzyParams) ([]string, error) {
	return nil, nil
}

func (s *stubCityQuerier) FindCityByAddress(_ context.Context, params repository.CitySearchParams) (*repository.CityResult, error) {
	s.gotParams = params
	return s.city, nil
}

// failingPrefixQuerier finds nothing via Levenshtein and fails the prefix query.
type failingPrefixQuerier struct{}

func (failingPrefixQuerier) FindBasicByLevenshtein(context.Context, repository.LevenshteinParams) ([]repository.BasicResult, error) {
	return nil, nil
}

func (failingPrefixQuerier) FindBasicByPrefix(context.Context, repository.PrefixParams) ([]repository.BasicResult, error) {
	return nil, errors.New("prefix query failed")
}

func (failingPrefixQuerier) FindCandidateLgCodes(context.Context, repository.CityFuzzyParams) ([]string, error) {
	return nil, nil
}

func (failingPrefixQuerier) FindCityByAddress(context.Context, repository.CitySearchParams) (*repository.CityResult, error) {
	return nil, nil
}

// A prefix-fallback query failure must surface as an error, not as "no match".
func TestSearch_PrefixFallbackErrorPropagates(t *testing.T) {
	_, err := Search(t.Context(), failingPrefixQuerier{}, SearchParams{
		Category:   model.CategoryBasic,
		SearchAddr: "宇佐市安心院町古川長坂",
		Limit:      1,
	})
	if err == nil {
		t.Fatal("Search() error = nil, want prefix query error")
	}
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

	_, err := tryFallbackCitySearchByScore(t.Context(), repo, SearchParams{
		Category:       model.CategoryAll,
		NormalizedAddr: "府中市上下町甲148番地",
		SearchAddr:     "府中市上下町甲148番地",
		Pref:           "34",
		Limit:          1,
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

	results, err := tryFallbackCitySearchByScore(t.Context(), repo, SearchParams{
		Category:       model.CategoryAll,
		NormalizedAddr: "福山市",
		SearchAddr:     "福山市",
		Limit:          1,
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

func TestIsOneTypoAway(t *testing.T) {
	result := func(oazaCho, koaza string) *model.MatchedResult {
		r := &model.MatchedResult{StructuredAddress: model.StructuredAddress{OazaCho: &oazaCho}}
		if koaza != "" {
			r.StructuredAddress.Koaza = &koaza
		}
		return r
	}
	tests := []struct {
		name      string
		inputTown string
		result    *model.MatchedResult
		want      bool
	}{
		{name: "one character off", inputTown: "日本橋小綱町", result: result("日本橋小網町", ""), want: true},
		{name: "another town", inputTown: "日本橋小綱町", result: result("日本橋堀留町", ""), want: false},
		{name: "same oaza, another koaza", inputTown: "南郷区島守赤羽", result: result("南郷区大字島守", "字五ッ役"), want: false},
		{name: "大字 left out of the input", inputTown: "深井親田", result: result("大字深井新田", ""), want: true},
		{name: "no input town", inputTown: "", result: result("日本橋小網町", ""), want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isOneTypoAway(tt.inputTown, tt.result); got != tt.want {
				t.Errorf("isOneTypoAway(%q) = %v, want %v", tt.inputTown, got, tt.want)
			}
		})
	}
}

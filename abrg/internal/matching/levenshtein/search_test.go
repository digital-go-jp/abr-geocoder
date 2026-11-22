package levenshtein

import (
	"context"
	"errors"
	"testing"

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

// lotQuerier returns fixed machiaza candidates.
type lotQuerier struct {
	stubCityQuerier
	candidates []repository.BasicResult
}

func (q *lotQuerier) FindBasicByLevenshtein(context.Context, repository.LevenshteinParams) ([]repository.BasicResult, error) {
	return q.candidates, nil
}

func chomeCandidate(machiazaID, oaza, chome, normalized string) repository.BasicResult {
	r := basicCandidate("北海道", "函館市", oaza, normalized)
	r.LgCode, r.MachiazaID = "012025", machiazaID
	if chome != "" {
		r.Chome = &chome
	}
	return r
}

// A lot number read as a chome takes neither that chome nor another town
// ranked after it.
func TestSearch_NumberAsChomeTakesNoTown(t *testing.T) {
	tomioka1 := chomeCandidate("0102001", "富岡町", "1丁目", "函館市富岡町1@")
	tomiura := chomeCandidate("0101000", "富浦町", "", "函館市富浦町")

	q := &lotQuerier{candidates: []repository.BasicResult{tomioka1, tomiura}}
	got, err := Search(context.Background(), q, SearchParams{
		SearchAddr:     "函館市富岡町:215",
		LgCode:         "012025",
		NormalizedAddr: "北海道函館市富岡町215番地",
		Limit:          1,
	})
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if len(got) > 0 {
		t.Fatalf("Search() = %q, want no result", got[0].MatchedAddress)
	}
}

func TestWrittenChomeTown(t *testing.T) {
	chome := func(normalized string) *repository.BasicResult {
		return &repository.BasicResult{NormalizedAddress: normalized}
	}
	tests := []struct {
		name        string
		searchAddr  string
		numberChome *repository.BasicResult
		want        string
	}{
		{"town written in full", "仙台市青葉区木町通:13", chome("仙台市青葉区木町通1@"), "仙台市青葉区木町通"},
		{"multi-digit chome", "仙台市青葉区木町通:13", chome("仙台市青葉区木町通12@"), "仙台市青葉区木町通"},
		{"another town", "姫路市白浜町甲:402-106", chome("姫路市白浜町寺家1@"), ""},
		{"no chome skipped", "仙台市青葉区木町通:13", nil, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := writtenChomeTown(tt.searchAddr, tt.numberChome); got != tt.want {
				t.Errorf("writtenChomeTown() = %q, want %q", got, tt.want)
			}
		})
	}
}

package levenshtein

import (
	"context"
	"errors"
	"reflect"
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

func (s *stubCityQuerier) FindChomesWithLot(context.Context, string, string, string) ([]repository.BasicResult, error) {
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

func (failingPrefixQuerier) FindChomesWithLot(context.Context, string, string, string) ([]repository.BasicResult, error) {
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

// lotQuerier returns fixed machiaza candidates and the chomes holding the lot.
type lotQuerier struct {
	stubCityQuerier
	candidates []repository.BasicResult
	chomes     []repository.BasicResult
	gotLot     string
}

func (q *lotQuerier) FindBasicByLevenshtein(context.Context, repository.LevenshteinParams) ([]repository.BasicResult, error) {
	return q.candidates, nil
}

func (q *lotQuerier) FindChomesWithLot(_ context.Context, _, _, prcNum1 string) ([]repository.BasicResult, error) {
	q.gotLot = prcNum1
	return q.chomes, nil
}

func chomeCandidate(machiazaID, oaza, chome, normalized string) repository.BasicResult {
	r := basicCandidate("北海道", "函館市", oaza, normalized)
	r.LgCode, r.MachiazaID = "012025", machiazaID
	if chome != "" {
		r.Chome = &chome
	}
	return r
}

// A lot number read as a chome leaves the town to the chomes holding the lot,
// never to another town ranked after it.
func TestSearch_NumberAsChomeResolvedByLot(t *testing.T) {
	tomioka1 := chomeCandidate("0102001", "富岡町", "1丁目", "函館市富岡町1@")
	tomioka2 := chomeCandidate("0102002", "富岡町", "2丁目", "函館市富岡町2@")
	tomioka3 := chomeCandidate("0102003", "富岡町", "3丁目", "函館市富岡町3@")
	tomiura := chomeCandidate("0101000", "富浦町", "", "函館市富浦町")

	tests := []struct {
		name      string
		hasParcel bool
		chomes    []repository.BasicResult
		want      string
	}{
		{"lot in one chome", true, []repository.BasicResult{tomioka3}, "北海道函館市富岡町3丁目"},
		{"lot in two chomes", true, []repository.BasicResult{tomioka1, tomioka2}, ""},
		{"no parcel data", false, []repository.BasicResult{tomioka3}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := &lotQuerier{candidates: []repository.BasicResult{tomioka1, tomiura}, chomes: tt.chomes}
			got, err := Search(context.Background(), q, SearchParams{
				Category:       model.CategoryBasic,
				SearchAddr:     "函館市富岡町:215",
				LgCode:         "012025",
				NormalizedAddr: "北海道函館市富岡町215番地",
				Limit:          1,
				HasParcel:      tt.hasParcel,
			})
			if err != nil {
				t.Fatalf("Search() error = %v", err)
			}
			var addr string
			if len(got) > 0 {
				addr = got[0].MatchedAddress
			}
			if addr != tt.want {
				t.Fatalf("Search() = %q, want %q", addr, tt.want)
			}
			if tt.want != "" {
				if q.gotLot != "215" {
					t.Errorf("lot searched = %q, want 215", q.gotLot)
				}
				if !reflect.DeepEqual(got[0].UnmatchedAddress, []string{"215"}) {
					t.Errorf("unmatched = %q, want [215]", got[0].UnmatchedAddress)
				}
			}
		})
	}
}

package levenshtein

import (
	"context"
	"testing"

	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// recordingQuerier reports a fixed set of candidate cities and records the
// machiaza query it receives, if any.
type recordingQuerier struct {
	candidates []string
	gotCity    repository.CityFuzzyParams
	searched   bool
	gotParams  repository.LevenshteinParams
}

func (r *recordingQuerier) FindCandidateLgCodes(_ context.Context, params repository.CityFuzzyParams) ([]string, error) {
	r.gotCity = params
	return r.candidates, nil
}

func (r *recordingQuerier) FindBasicByLevenshtein(_ context.Context, params repository.LevenshteinParams) ([]repository.BasicResult, error) {
	r.searched = true
	r.gotParams = params
	return nil, nil
}

func (r *recordingQuerier) FindBasicByPrefix(_ context.Context, _ repository.PrefixParams) ([]repository.BasicResult, error) {
	return nil, nil
}

func (r *recordingQuerier) FindCityByAddress(_ context.Context, _ repository.CitySearchParams) (*repository.CityResult, error) {
	return nil, nil
}

func anchorlessParams(searchAddr string) SearchParams {
	return SearchParams{
		Category:     model.CategoryBasic,
		SearchAddr:   searchAddr,
		Pref:         model.All,
		Limit:        1,
		CityBoundary: util.NewCityBoundary(nil),
	}
}

// An address with no region code must not reach cache_machiaza unless a city
// name bounds the query: unfiltered, editdist3 runs over every machiaza in the
// country. Regression test for issue #247.
func TestSearchCore_AnchorlessAddressSkipsMachiazaQuery(t *testing.T) {
	tests := []struct {
		name       string
		searchAddr string
		candidates []string
	}{
		{
			name:       "no city in the address",
			searchAddr: "ニューヨークシティマンハッタンフィフスアベニュー350",
		},
		{
			name:       "city name matching no city",
			searchAddr: "ヨクワカラナイ市不明町",
			candidates: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &recordingQuerier{candidates: tt.candidates}

			if _, err := searchCore(t.Context(), repo, anchorlessParams(tt.searchAddr)); err != nil {
				t.Fatalf("searchCore() error = %v", err)
			}
			if repo.searched {
				t.Error("FindBasicByLevenshtein was called with no region filter")
			}
		})
	}
}

// A misspelled city name carries no code but still names a region, so the
// cities closest to it become the filter the machiaza query scopes on.
func TestSearchCore_CandidateCitiesScopeQuery(t *testing.T) {
	repo := &recordingQuerier{candidates: []string{"141305", "141313"}}

	if _, err := searchCore(t.Context(), repo, anchorlessParams("横浜巿西区ミナトミライ")); err != nil {
		t.Fatalf("searchCore() error = %v", err)
	}

	if repo.gotCity.CityPart != "横浜巿西区" {
		t.Errorf("candidate lookup CityPart = %q, want %q", repo.gotCity.CityPart, "横浜巿西区")
	}
	if !repo.searched {
		t.Fatal("FindBasicByLevenshtein was not called for an address naming a city")
	}
	if len(repo.gotParams.LgCodes) != 2 {
		t.Errorf("LgCodes = %v, want the two candidate codes", repo.gotParams.LgCodes)
	}
}

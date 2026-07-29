package matching

import (
	"context"
	"errors"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/model"
	"abrg/internal/normalize"
	"abrg/internal/repository"
)

// failingQuerier fails every repository query.
type failingQuerier struct{}

var errQueryFailed = errors.New("query failed")

func (failingQuerier) FindCityRecord(context.Context, repository.CityRecordParams) (*repository.CityResult, error) {
	return nil, errQueryFailed
}

func (failingQuerier) FindCityRecordFuzzy(context.Context, repository.CityFuzzyParams) (*repository.CityResult, error) {
	return nil, errQueryFailed
}

func (failingQuerier) FindPrefecture(context.Context, string) (*repository.PrefectureResult, error) {
	return nil, errQueryFailed
}

func (failingQuerier) FindBasicByAddress(context.Context, repository.BasicSearchParams) ([]repository.BasicResult, error) {
	return nil, errQueryFailed
}

func (failingQuerier) FindBasicByLevenshtein(context.Context, repository.LevenshteinParams) ([]repository.BasicResult, error) {
	return nil, errQueryFailed
}

func (failingQuerier) FindBasicByPrefix(context.Context, repository.PrefixParams) ([]repository.BasicResult, error) {
	return nil, errQueryFailed
}

func (failingQuerier) FindCityByAddress(context.Context, repository.CitySearchParams) (*repository.CityResult, error) {
	return nil, errQueryFailed
}

func (failingQuerier) FindResidentialBestMatch(context.Context, string, string, repository.ResidentialFilter) (*repository.ResidentialBestResult, error) {
	return nil, errQueryFailed
}

func (failingQuerier) FindParcelExact(context.Context, string, string, repository.ParcelFilter) (*repository.ParcelResult, error) {
	return nil, errQueryFailed
}

// A repository failure during ward expansion must surface as an error,
// not as "no match".
func TestTryWardExpansion_PropagatesQueryError(t *testing.T) {
	n := &Impl{
		repo: failingQuerier{},
		wardCandidates: map[string][]cache.WardCandidate{
			"中区": {{CityWard: "横浜市中区", PrefCode: "14"}},
		},
	}

	query := model.MatchQuery{Address: "中区本町", Category: model.CategoryBasic, Pref: model.All, Limit: 1}
	_, err := n.tryWardExpansion(t.Context(), query, "中区本町", model.NormalizeCategoryUndetermined, nil)
	if !errors.Is(err, errQueryFailed) {
		t.Fatalf("tryWardExpansion() error = %v, want %v", err, errQueryFailed)
	}
}

// Ward expansion runs every candidate city without the Levenshtein search
// first, and repeats the whole set with it only when no candidate reached a
// machiaza. These cases pin which side of that split each input falls on.
func TestMatchNormalizedSkipLevenshtein(t *testing.T) {
	n := setupTestMatcher(t)

	tests := []struct {
		name                string
		addr                string
		wantSkipLevenshtein model.MatchLevel
		wantWithLevenshtein model.MatchLevel
	}{
		{
			name:                "machiaza present in the data",
			addr:                "福岡市南区大橋1丁目",
			wantSkipLevenshtein: model.MatchLevelMachiazaDetail,
			wantWithLevenshtein: model.MatchLevelMachiazaDetail,
		},
		{
			// A numeric koaza resolves in handleBasicFallback, not the Levenshtein search.
			name:                "numeric koaza",
			addr:                "福岡市南区折立町98300",
			wantSkipLevenshtein: model.MatchLevelMachiazaDetail,
			wantWithLevenshtein: model.MatchLevelMachiazaDetail,
		},
		{
			// 大倉 is not a machiaza on its own; 大倉字南 is, and only the
			// Levenshtein search reaches it.
			name:                "koaza completion",
			addr:                "仙台市青葉区大倉",
			wantSkipLevenshtein: model.MatchLevelCity,
			wantWithLevenshtein: model.MatchLevelMachiazaDetail,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := model.MatchQuery{Address: tt.addr, Category: model.CategoryAll, Pref: model.All, Limit: 1}
			normalizedAddr, addressType := normalize.NormalizeBasicNormalized(normalize.BasicNormalize(tt.addr))

			check := func(skipLevenshtein bool, want model.MatchLevel) {
				t.Helper()
				results, err := n.matchNormalized(t.Context(), query, normalizedAddr, addressType, skipLevenshtein)
				if err != nil {
					t.Fatalf("matchNormalized(skipLevenshtein=%v) error: %v", skipLevenshtein, err)
				}
				if len(results) == 0 {
					t.Fatalf("matchNormalized(skipLevenshtein=%v) returned no results", skipLevenshtein)
				}
				if got := results[0].MatchLevel; got != want {
					t.Errorf("matchNormalized(skipLevenshtein=%v) match level = %v, want %v", skipLevenshtein, got, want)
				}
			}
			check(true, tt.wantSkipLevenshtein)
			check(false, tt.wantWithLevenshtein)
		})
	}
}

func TestExtractWardPrefix(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"standard ward", "中区本町", "中区"},
		{"compound ward", "中央区銀座", "中央区"},
		{"no ward", "本町1-1", ""},
		{"empty", "", ""},
		{"ward only", "中区", "中区"},
		{"ward at start with numbers", "南区白妙町1-1", "南区"},
		// When city+ward is present, extractWardPrefix finds the first 区.
		// This is fine because the wardCandidates lookup won't match a city+ward key.
		{"city+ward returns up to first ku", "京都市下京区河原町", "京都市下京区"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := extractWardPrefix(tt.input)
			if got != tt.want {
				t.Errorf("extractWardPrefix(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

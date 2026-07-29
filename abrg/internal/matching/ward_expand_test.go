package matching

import (
	"context"
	"errors"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/model"
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

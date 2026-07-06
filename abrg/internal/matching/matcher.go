package matching

import (
	"context"

	"abrg/internal/cache"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// implQuerier is a consumer-defined interface for the matcher's data access needs.
type implQuerier interface {
	FindCityRecord(ctx context.Context, params repository.CityRecordParams) (*repository.CityResult, error)
	FindCityRecordFuzzy(ctx context.Context, params repository.CityFuzzyParams) (*repository.CityResult, error)
	FindPrefecture(ctx context.Context, prefCode string) (*repository.PrefectureResult, error)
	FindBasicByAddress(ctx context.Context, params repository.BasicSearchParams) ([]repository.BasicResult, error)
	FindBasicByLevenshtein(ctx context.Context, params repository.LevenshteinParams) ([]repository.BasicResult, error)
	FindBasicByPrefix(ctx context.Context, params repository.PrefixParams) ([]repository.BasicResult, error)
	FindCityByAddress(ctx context.Context, params repository.CitySearchParams) (*repository.CityResult, error)
	FindResidentialBestMatch(ctx context.Context, lgCode, machiazaID string, filter repository.ResidentialFilter) (*repository.ResidentialBestResult, error)
	FindParcelExact(ctx context.Context, lgCode, machiazaID string, filter repository.ParcelFilter) (*repository.ParcelResult, error)
}

// Matcher is the interface for address matching against ABR data.
type Matcher interface {
	Match(ctx context.Context, query model.MatchQuery) (*model.MatchResponse, error)
}

// Impl is the matching service implementation.
type Impl struct {
	repo            implQuerier
	cityPrefixMap   cityPrefixMap
	cityWardLgCodes map[string]string
	wardCandidates  map[string][]cache.WardCandidate
	cityBoundary    *util.CityBoundary
	twoStageSearch  *twoStageSearch
}

// NewMatcher creates a new matcher instance.
func NewMatcher(repo implQuerier, lookups cache.Lookups) *Impl {
	return &Impl{
		repo:            repo,
		cityPrefixMap:   buildCityPrefixMap(lookups.CityPrefCodes),
		cityWardLgCodes: lookups.CityWardLgCodes,
		wardCandidates:  lookups.WardCandidates,
		cityBoundary:    lookups.CityBoundary,
		twoStageSearch:  newTwoStageSearch(repo),
	}
}

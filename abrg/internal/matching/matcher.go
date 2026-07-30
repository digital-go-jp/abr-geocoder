package matching

import (
	"context"
	"errors"

	"abrg/internal/cache"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// ErrDataUnavailable marks match queries whose backing category data is not
// loaded in the current cache. The HTTP layer maps it to 503. Request
// validation normally rejects such categories with 400 first; this error
// guards direct matcher use.
var ErrDataUnavailable = errors.New("data not available in current cache")

// ErrUnknownCategory marks match queries naming a category the matcher does
// not implement. The HTTP layer maps it to 400.
var ErrUnknownCategory = errors.New("unknown category")

// implQuerier is a consumer-defined interface for the matcher's data access needs.
type implQuerier interface {
	FindCityRecord(ctx context.Context, params repository.CityRecordParams) (*repository.CityResult, error)
	FindCityRecordFuzzy(ctx context.Context, params repository.CityFuzzyParams) (*repository.CityResult, error)
	FindCandidateLgCodes(ctx context.Context, params repository.CityFuzzyParams) ([]string, error)
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
	hasResidential  bool
	hasParcel       bool
}

// NewMatcher creates a new matcher instance. hasResidential and hasParcel
// report which category data the cache was built with (cache.Config
// .HasResidential/HasParcel); categories without data are answered with
// ErrDataUnavailable instead of querying missing tables.
func NewMatcher(repo implQuerier, lookups cache.Lookups, hasResidential, hasParcel bool) *Impl {
	return &Impl{
		repo:            repo,
		cityPrefixMap:   buildCityPrefixMap(lookups.CityPrefCodes),
		cityWardLgCodes: lookups.CityWardLgCodes,
		wardCandidates:  lookups.WardCandidates,
		cityBoundary:    lookups.CityBoundary,
		twoStageSearch:  newTwoStageSearch(repo),
		hasResidential:  hasResidential,
		hasParcel:       hasParcel,
	}
}

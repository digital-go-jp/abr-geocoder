package reverse

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"sync"
	"time"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/matchlevel"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/repository"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/util"
)

// spatialQuerier is the repository subset used for reverse geocoding.
type spatialQuerier interface {
	FindNearestBasic(ctx context.Context, params repository.SpatialParams) ([]repository.ReverseBaseFields, error)
	FindNearestResidential(ctx context.Context, params repository.SpatialParams) ([]repository.ReverseResidentialResult, error)
	FindNearestParcel(ctx context.Context, params repository.SpatialParams) ([]repository.ReverseParcelResult, error)
}

// searchRadius bounds the reverse search, in metres.
const searchRadius = 1000

// ErrDataUnavailable marks a category whose table is not in the current cache.
// The HTTP layer maps it to 503.
var ErrDataUnavailable = errors.New("data not available in current cache")

// ErrUnknownCategory marks an unrecognized reverse category. The HTTP layer
// maps it to 400.
var ErrUnknownCategory = errors.New("unknown category")

// ReverseGeocoder provides reverse geocoding.
type ReverseGeocoder struct {
	repo           spatialQuerier
	hasResidential bool
	hasParcel      bool
}

// NewReverseGeocoder creates a ReverseGeocoder.
func NewReverseGeocoder(repo spatialQuerier, hasResidential, hasParcel bool) *ReverseGeocoder {
	return &ReverseGeocoder{
		repo:           repo,
		hasResidential: hasResidential,
		hasParcel:      hasParcel,
	}
}

// Reverse performs reverse geocoding on coordinates.
func (g *ReverseGeocoder) Reverse(ctx context.Context, query model.ReverseQuery) (*model.ReverseResponse, error) {
	startTime := time.Now()

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	if query.Limit <= 0 {
		query.Limit = 1
	}

	features, err := g.findNearestAddresses(ctx, query)
	if err != nil {
		return nil, err
	}

	for i := range features {
		util.RoundCoordinates(features[i].Geometry.Coordinates)
	}

	duration := util.DurationMs(time.Since(startTime))

	return &model.ReverseResponse{
		Type:  "FeatureCollection",
		Query: query,
		ResultInfo: model.ResultInfo{
			Count:      len(features),
			Limit:      query.Limit,
			DurationMs: duration,
		},
		Features: features,
	}, nil
}

// findNearestAddresses searches the table of query.Category. CategoryAll combines
// the loaded tables; any other category fails if its table is not loaded.
func (g *ReverseGeocoder) findNearestAddresses(ctx context.Context, query model.ReverseQuery) ([]model.ReverseFeature, error) {
	params := spatialParams(query)

	if query.Category == model.CategoryAll {
		return g.findNearestAll(ctx, params)
	}

	for _, src := range g.sources() {
		if src.category != query.Category {
			continue
		}
		if !src.available {
			return nil, fmt.Errorf("%s %w", src.name, ErrDataUnavailable)
		}
		return src.find(ctx, params)
	}
	return nil, fmt.Errorf("%w: %s", ErrUnknownCategory, query.Category)
}

// reverseSource ties a category to whether its table is loaded and to the
// function that finds its features. sources is the only list of reverse
// categories, shared by the single-category path and findNearestAll.
type reverseSource struct {
	category  model.Category
	name      string // log/error label, which differs from the category string for rsdtdsp
	available bool
	find      func(context.Context, repository.SpatialParams) ([]model.ReverseFeature, error)
}

// sources returns the reverse sources in the order findNearestAll combines them.
func (g *ReverseGeocoder) sources() []reverseSource {
	return []reverseSource{
		{model.CategoryResidential, "residential", g.hasResidential, func(ctx context.Context, p repository.SpatialParams) ([]model.ReverseFeature, error) {
			return findAndBuild(ctx, g.repo.FindNearestResidential, p, buildResidentialFeature)
		}},
		{model.CategoryParcel, "parcel", g.hasParcel, func(ctx context.Context, p repository.SpatialParams) ([]model.ReverseFeature, error) {
			return findAndBuild(ctx, g.repo.FindNearestParcel, p, buildParcelFeature)
		}},
		{model.CategoryBasic, "basic", true, func(ctx context.Context, p repository.SpatialParams) ([]model.ReverseFeature, error) {
			return findAndBuild(ctx, g.repo.FindNearestBasic, p, buildBasicFeature)
		}},
	}
}

// spatialParams builds repository query parameters from a reverse query.
func spatialParams(q model.ReverseQuery) repository.SpatialParams {
	return repository.SpatialParams{
		Lon:    q.Lon,
		Lat:    q.Lat,
		Limit:  q.Limit,
		Pref:   q.Pref,
		Radius: searchRadius,
	}
}

// findAndBuild finds nearest results and builds features from them.
func findAndBuild[T any](ctx context.Context, findFn func(context.Context, repository.SpatialParams) ([]T, error), params repository.SpatialParams, buildFn func(T) model.ReverseFeature) ([]model.ReverseFeature, error) {
	results, err := findFn(ctx, params)
	if err != nil {
		return nil, err
	}
	features := make([]model.ReverseFeature, 0, len(results))
	for _, r := range results {
		features = append(features, buildFn(r))
	}
	return features, nil
}

// findNearestAll queries every loaded table concurrently and returns the nearest
// features. Failed queries are logged and skipped; an error is returned only
// when no features were found and some query failed.
func (g *ReverseGeocoder) findNearestAll(ctx context.Context, params repository.SpatialParams) ([]model.ReverseFeature, error) {
	sources := g.sources()

	results := make([][]model.ReverseFeature, len(sources))
	errs := make([]error, len(sources))
	var wg sync.WaitGroup
	for i, src := range sources {
		if !src.available {
			continue
		}
		wg.Go(func() {
			results[i], errs[i] = src.find(ctx, params)
		})
	}
	wg.Wait()

	var allResults []model.ReverseFeature
	for i, src := range sources {
		if errs[i] != nil {
			slog.Error("reverse "+src.name+" query failed", "event", "reverse_"+src.name+"_query",
				"lon", params.Lon, "lat", params.Lat, "pref", params.Pref, "error", errs[i])
			continue
		}
		allResults = append(allResults, results[i]...)
	}

	if len(allResults) == 0 {
		if err := errors.Join(errs...); err != nil {
			return nil, fmt.Errorf("no reverse geocoding results; a query failed: %w", err)
		}
		return nil, nil
	}

	slices.SortFunc(allResults, func(a, b model.ReverseFeature) int {
		return cmp.Compare(a.Properties.Distance, b.Properties.Distance)
	})

	return allResults[:min(len(allResults), params.Limit)], nil
}

// buildReverseFeature builds the point feature shared by all categories.
func buildReverseFeature(sa model.StructuredAddress, ids model.IDs, lon, lat, distance float64) model.ReverseFeature {
	return model.ReverseFeature{
		Type: "Feature",
		Geometry: model.Geometry{
			Type:        "Point",
			Coordinates: []float64{lon, lat},
		},
		Properties: model.ReverseProperties{
			Address:           model.FormatAddress(&sa),
			MatchLevel:        matchlevel.DetermineMatchLevel(&ids),
			Distance:          distance,
			IDs:               ids,
			StructuredAddress: sa,
		},
	}
}

// buildBasicFeature builds a ReverseFeature for basic (town-level) data.
func buildBasicFeature(b repository.ReverseBaseFields) model.ReverseFeature {
	ids := repository.BuildIDs(b.LgCode, b.MachiazaID, b.RsdtAddrFlg)
	return buildReverseFeature(b.BaseSA(), ids, b.Lon, b.Lat, b.Distance)
}

// buildResidentialFeature builds a ReverseFeature for residential data.
func buildResidentialFeature(r repository.ReverseResidentialResult) model.ReverseFeature {
	sa := r.BaseSA()
	sa.BlkNum = r.BlkNum
	sa.RsdtNum = r.RsdtNum
	sa.RsdtNum2 = r.RsdtNum2

	ids := repository.BuildIDs(r.LgCode, r.MachiazaID, r.RsdtAddrFlg)
	ids.BlkID = r.BlkID
	ids.RsdtID = r.RsdtID
	ids.Rsdt2ID = r.Rsdt2ID

	return buildReverseFeature(sa, ids, r.Lon, r.Lat, r.Distance)
}

// buildParcelFeature builds a ReverseFeature for parcel data.
func buildParcelFeature(r repository.ReverseParcelResult) model.ReverseFeature {
	sa := r.BaseSA()
	sa.PrcNum1 = r.PrcNum1
	sa.PrcNum2 = r.PrcNum2
	sa.PrcNum3 = r.PrcNum3

	ids := repository.BuildIDs(r.LgCode, r.MachiazaID, r.RsdtAddrFlg)
	ids.PrcID = r.PrcID

	return buildReverseFeature(sa, ids, r.Lon, r.Lat, r.Distance)
}

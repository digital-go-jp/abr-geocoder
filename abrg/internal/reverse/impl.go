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

	"abrg/internal/matchlevel"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/util"
)

// spatialQuerier is a consumer-defined interface for spatial (reverse geocoding) queries.
type spatialQuerier interface {
	FindNearestBasic(ctx context.Context, params repository.SpatialParams) ([]repository.ReverseBaseFields, error)
	FindNearestResidential(ctx context.Context, params repository.SpatialParams) ([]repository.ReverseResidentialResult, error)
	FindNearestParcel(ctx context.Context, params repository.SpatialParams) ([]repository.ReverseParcelResult, error)
}

// searchRadius is the search radius in degrees (~1km at latitude 35).
const searchRadius = 0.009

// ErrDataUnavailable marks reverse queries whose backing data is not loaded
// in the current cache. The HTTP layer maps it to 503.
var ErrDataUnavailable = errors.New("data not available in current cache")

// ErrUnknownCategory marks an unrecognized reverse category. The HTTP layer
// maps it to 400.
var ErrUnknownCategory = errors.New("unknown category")

// ReverseGeocoder provides reverse geocoding using DuckDB spatial queries.
type ReverseGeocoder struct {
	repo           spatialQuerier
	hasResidential bool
	hasParcel      bool
}

// NewReverseGeocoder creates a new reverse geocoder instance.
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

	// Find nearest addresses based on category level
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

// findNearestAddresses finds the nearest addresses based on the category level.
// CategoryAll returns partial results from available tables (residential, parcel, basic).
// Specific categories require the requested table to be available in cache.
func (g *ReverseGeocoder) findNearestAddresses(ctx context.Context, query model.ReverseQuery) ([]model.ReverseFeature, error) {
	params := spatialParams(query)

	switch query.Category {
	case model.CategoryAll:
		// Partial success is acceptable (returns data from available tables)
		return g.findNearestAll(ctx, params)
	case model.CategoryBasic:
		return findAndBuild(ctx, g.repo.FindNearestBasic, params, buildBasicFeature)
	case model.CategoryResidential:
		if !g.hasResidential {
			return nil, fmt.Errorf("residential %w", ErrDataUnavailable)
		}
		return findAndBuild(ctx, g.repo.FindNearestResidential, params, buildResidentialFeature)
	case model.CategoryParcel:
		if !g.hasParcel {
			return nil, fmt.Errorf("parcel %w", ErrDataUnavailable)
		}
		return findAndBuild(ctx, g.repo.FindNearestParcel, params, buildParcelFeature)
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnknownCategory, query.Category)
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

// findNearestAll finds addresses from all levels.
// Returns partial results if some queries fail (errors are logged).
func (g *ReverseGeocoder) findNearestAll(ctx context.Context, params repository.SpatialParams) ([]model.ReverseFeature, error) {
	sources := []struct {
		name      string
		available bool
		find      func(context.Context, repository.SpatialParams) ([]model.ReverseFeature, error)
	}{
		{"residential", g.hasResidential, func(ctx context.Context, p repository.SpatialParams) ([]model.ReverseFeature, error) {
			return findAndBuild(ctx, g.repo.FindNearestResidential, p, buildResidentialFeature)
		}},
		{"parcel", g.hasParcel, func(ctx context.Context, p repository.SpatialParams) ([]model.ReverseFeature, error) {
			return findAndBuild(ctx, g.repo.FindNearestParcel, p, buildParcelFeature)
		}},
		{"basic", true, func(ctx context.Context, p repository.SpatialParams) ([]model.ReverseFeature, error) {
			return findAndBuild(ctx, g.repo.FindNearestBasic, p, buildBasicFeature)
		}},
	}

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

	// Log query errors and combine results from successful sources
	var allResults []model.ReverseFeature
	for i, src := range sources {
		if errs[i] != nil {
			slog.Error("reverse "+src.name+" query failed", "event", "reverse_"+src.name+"_query",
				"lon", params.Lon, "lat", params.Lat, "pref", params.Pref, "error", errs[i])
			continue
		}
		allResults = append(allResults, results[i]...)
	}

	// Return error if all queries failed
	if len(allResults) == 0 {
		if err := errors.Join(errs...); err != nil {
			return nil, fmt.Errorf("all reverse geocoding queries failed: %w", err)
		}
		return nil, nil
	}

	// Sort by distance and apply limit
	slices.SortFunc(allResults, func(a, b model.ReverseFeature) int {
		return cmp.Compare(a.Properties.Distance, b.Properties.Distance)
	})

	return allResults[:min(len(allResults), params.Limit)], nil
}

// buildReverseFeature creates a ReverseFeature with common structure.
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
	ids := repository.BuildBaseIDs(b.LgCode, b.MachiazaID, b.RsdtAddrFlg)
	return buildReverseFeature(b.BaseSA(), ids, b.Lon, b.Lat, b.Distance)
}

// buildResidentialFeature builds a ReverseFeature for residential data.
func buildResidentialFeature(r repository.ReverseResidentialResult) model.ReverseFeature {
	sa := r.BaseSA()
	sa.BlkNum = r.BlkNum
	sa.RsdtNum = r.RsdtNum
	sa.RsdtNum2 = r.RsdtNum2

	ids := repository.BuildBaseIDs(r.LgCode, r.MachiazaID, r.RsdtAddrFlg)
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

	ids := repository.BuildBaseIDs(r.LgCode, r.MachiazaID, r.RsdtAddrFlg)
	ids.PrcID = r.PrcID

	return buildReverseFeature(sa, ids, r.Lon, r.Lat, r.Distance)
}

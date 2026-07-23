package reverse

import (
	"cmp"
	"context"
	"database/sql"
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

// TableExists checks if a table exists in the database using DuckDB's information schema.
func TableExists(ctx context.Context, db *sql.DB, tableName string) bool {
	var exists bool
	// Use parameterized query to avoid SQL injection
	err := db.QueryRowContext(ctx,
		"SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = ?)",
		tableName,
	).Scan(&exists)
	if err != nil {
		slog.Warn("failed to check table existence", "table", tableName, "error", err)
		return false
	}
	return exists
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
	// CategoryAll: partial success is acceptable (returns data from available tables)
	if query.Category == model.CategoryAll {
		return g.findNearestAll(ctx, query.Lon, query.Lat, query.Limit, query.Pref)
	}

	// Specific category: validate availability
	var findFunc func(context.Context, float64, float64, int, string) ([]model.ReverseFeature, error)
	switch query.Category {
	case model.CategoryBasic:
		findFunc = g.findNearestBasic
	case model.CategoryResidential:
		if !g.hasResidential {
			return nil, fmt.Errorf("residential data not available in current cache")
		}
		findFunc = g.findNearestResidential
	case model.CategoryParcel:
		if !g.hasParcel {
			return nil, fmt.Errorf("parcel data not available in current cache")
		}
		findFunc = g.findNearestParcel
	default:
		return nil, fmt.Errorf("unknown category: %s", query.Category)
	}

	return findFunc(ctx, query.Lon, query.Lat, query.Limit, query.Pref)
}

func (g *ReverseGeocoder) spatialParams(lon, lat float64, limit int, pref string) repository.SpatialParams {
	return repository.SpatialParams{
		Lon:    lon,
		Lat:    lat,
		Limit:  limit,
		Pref:   pref,
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

// findNearestBasic finds the nearest address at town level.
func (g *ReverseGeocoder) findNearestBasic(ctx context.Context, lon, lat float64, limit int, pref string) ([]model.ReverseFeature, error) {
	return findAndBuild(ctx, g.repo.FindNearestBasic, g.spatialParams(lon, lat, limit, pref), buildBasicFeature)
}

// findNearestResidential finds the nearest residential address.
func (g *ReverseGeocoder) findNearestResidential(ctx context.Context, lon, lat float64, limit int, pref string) ([]model.ReverseFeature, error) {
	return findAndBuild(ctx, g.repo.FindNearestResidential, g.spatialParams(lon, lat, limit, pref), buildResidentialFeature)
}

// findNearestParcel finds the nearest parcel address.
func (g *ReverseGeocoder) findNearestParcel(ctx context.Context, lon, lat float64, limit int, pref string) ([]model.ReverseFeature, error) {
	return findAndBuild(ctx, g.repo.FindNearestParcel, g.spatialParams(lon, lat, limit, pref), buildParcelFeature)
}

// findNearestAll finds addresses from all levels.
// Returns partial results if some queries fail (errors are logged).
func (g *ReverseGeocoder) findNearestAll(ctx context.Context, lon, lat float64, limit int, pref string) ([]model.ReverseFeature, error) {
	var wg sync.WaitGroup
	var residentialResults, parcelResults, basicResults []model.ReverseFeature
	var residentialErr, parcelErr, basicErr error

	// Only query tables that exist
	if g.hasResidential {
		wg.Go(func() {
			residentialResults, residentialErr = g.findNearestResidential(ctx, lon, lat, limit, pref)
		})
	}

	if g.hasParcel {
		wg.Go(func() {
			parcelResults, parcelErr = g.findNearestParcel(ctx, lon, lat, limit, pref)
		})
	}

	wg.Go(func() {
		basicResults, basicErr = g.findNearestBasic(ctx, lon, lat, limit, pref)
	})

	wg.Wait()

	// Log query errors and combine results from successful sources
	var allResults []model.ReverseFeature
	if residentialErr != nil {
		slog.Error("reverse residential query failed", "event", "reverse_residential_query", "lon", lon, "lat", lat, "pref", pref, "error", residentialErr)
	} else {
		allResults = append(allResults, residentialResults...)
	}
	if parcelErr != nil {
		slog.Error("reverse parcel query failed", "event", "reverse_parcel_query", "lon", lon, "lat", lat, "pref", pref, "error", parcelErr)
	} else {
		allResults = append(allResults, parcelResults...)
	}
	if basicErr != nil {
		slog.Error("reverse basic query failed", "event", "reverse_basic_query", "lon", lon, "lat", lat, "pref", pref, "error", basicErr)
	} else {
		allResults = append(allResults, basicResults...)
	}

	// Return error if all queries failed
	if len(allResults) == 0 {
		if residentialErr != nil || parcelErr != nil || basicErr != nil {
			return nil, fmt.Errorf("all reverse geocoding queries failed")
		}
		return nil, nil
	}

	// Sort by distance and apply limit
	slices.SortFunc(allResults, func(a, b model.ReverseFeature) int {
		return cmp.Compare(a.Properties.Distance, b.Properties.Distance)
	})

	return allResults[:min(len(allResults), limit)], nil
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

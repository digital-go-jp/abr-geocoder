package matching

import (
	"context"
	"time"

	"abrg/internal/model"
	"abrg/internal/util"
)

// CoordinatesGetter is a consumer-defined interface for coordinate lookups.
type CoordinatesGetter interface {
	Coordinates(ctx context.Context, lgCode, machiazaID string) ([]float64, model.MatchLevel)
}

// Geocode performs geocoding by matching the address and enriching results with coordinates.
func Geocode(ctx context.Context, matcher Matcher, repo CoordinatesGetter, query model.MatchQuery) (*model.GeocodeResponse, error) {
	startTime := time.Now()

	matchResult, err := matcher.Match(ctx, query)
	if err != nil {
		return nil, err
	}

	features := make([]model.GeocodeFeature, 0, len(matchResult.Features))

	for _, normalized := range matchResult.Features {
		// Use coordinates from normalize result if available, otherwise try parent level
		coordinates, coordinatesLevel := normalized.Coordinates, normalized.MatchLevel
		if len(coordinates) == 0 {
			coordinates, coordinatesLevel = getCoordinatesFromParent(ctx, repo, normalized.IDs)
		}

		feature := model.GeocodeFeature{
			Type: "Feature",
			Properties: model.GeocodeProperties{
				MatchedAddress:    normalized.MatchedAddress,
				UnmatchedAddress:  normalized.UnmatchedAddress,
				Score:             normalized.Score,
				MatchLevel:        normalized.MatchLevel,
				IDs:               normalized.IDs,
				StructuredAddress: normalized.StructuredAddress,
			},
		}

		if len(coordinates) > 0 {
			util.RoundCoordinates(coordinates)
			feature.Geometry = &model.Geometry{
				Type:        "Point",
				Coordinates: coordinates,
			}
			feature.Properties.CoordinatesLevel = &coordinatesLevel
		}

		features = append(features, feature)
	}

	duration := util.DurationMs(time.Since(startTime))

	return &model.GeocodeResponse{
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

// getCoordinatesFromParent tries to get coordinates from parent level (basic) if current level has no coordinates.
func getCoordinatesFromParent(ctx context.Context, repo CoordinatesGetter, ids model.IDs) ([]float64, model.MatchLevel) {
	if repo == nil {
		return nil, ""
	}

	lgCode := derefString(ids.LgCode)
	if lgCode == "" {
		return nil, ""
	}
	machiazaID := derefString(ids.MachiazaID)

	return repo.Coordinates(ctx, lgCode, machiazaID)
}

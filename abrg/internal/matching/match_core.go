// Package matching implements the address matching pipeline: normalization,
// prefecture and machiaza detection, two-stage residential/parcel search,
// Levenshtein fallback, and result assembly.
package matching

import (
	"context"
	"fmt"
	"time"

	"abrg/internal/model"
	"abrg/internal/normalize"
	"abrg/internal/util"
)

// Match processes an address and returns matching results against ABR data.
func (n *Impl) Match(ctx context.Context, query model.MatchQuery) (*model.MatchResponse, error) {
	startTime := time.Now()

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	if query.Limit <= 0 {
		query.Limit = 1
	}

	results, err := n.normalizeAddress(ctx, query)
	if err != nil {
		return nil, err
	}

	return &model.MatchResponse{
		Type:  "MatchResult",
		Query: query,
		ResultInfo: model.ResultInfo{
			Count:      len(results),
			Limit:      query.Limit,
			DurationMs: util.DurationMs(time.Since(startTime)),
		},
		Features: results,
	}, nil
}

// normalizeAddress normalizes an address based on the category level.
func (n *Impl) normalizeAddress(ctx context.Context, query model.MatchQuery) ([]model.MatchedResult, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	normalizedAddr := normalize.BasicNormalize(query.Address)
	normalizedAddr, addressType := normalize.NormalizeAddressTextWithBasic("", &normalizedAddr)
	pref, searchAddr, basicResults, err := n.detectBasicResultsWithBasic(ctx, normalizedAddr, query.Pref, normalizedAddr)
	if err != nil {
		return nil, fmt.Errorf("detect basic results: %w", err)
	}

	lgCode, machiazaID := extractIDs(basicResults)

	// If location detection failed, return unmatched result
	if pref == model.All && lgCode == "" && machiazaID == "" {
		return []model.MatchedResult{util.CreateUnmatchedResult(normalizedAddr)}, nil
	}

	nctx := &normalizeContext{
		Input: normalizeInput{
			NormalizedAddr:   normalizedAddr,
			StandardizedAddr: normalizedAddr,
			SearchAddr:       parseSearchAddr(searchAddr),
			Pref:             pref,
			Limit:            query.Limit,
			Category:         query.Category,
			AddressType:      addressType,
		},
		State: normalizeState{
			LgCode:       lgCode,
			MachiazaID:   machiazaID,
			BasicResults: basicResults,
		},
	}

	return n.normalizeByCategory(ctx, nctx, query.Category)
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// extractIDs extracts lgCode and machiazaID from basic results.
func extractIDs(basicResults []model.MatchedResult) (string, string) {
	if len(basicResults) == 0 {
		return "", ""
	}
	ids := basicResults[0].IDs
	return derefString(ids.LgCode), derefString(ids.MachiazaID)
}

// normalizeByCategory processes normalization based on category type.
func (n *Impl) normalizeByCategory(ctx context.Context, nctx *normalizeContext, category model.Category) ([]model.MatchedResult, error) {
	if category == "" {
		category = model.CategoryAll
	}

	switch category {
	case model.CategoryBasic:
		return n.handleFallback(ctx, nctx)
	case model.CategoryResidential:
		return n.tryTwoStageOrFallback(ctx, nctx, n.tryTwoStageResidential)
	case model.CategoryParcel:
		return n.tryTwoStageOrFallback(ctx, nctx, n.tryTwoStageParcel)
	case model.CategoryAll:
		return n.normalizeAll(ctx, nctx)
	default:
		return nil, fmt.Errorf("unknown category: %s", category)
	}
}

// tryTwoStageOrFallback tries the given two-stage function and falls back if no results.
func (n *Impl) tryTwoStageOrFallback(ctx context.Context, nctx *normalizeContext, tryFunc func(context.Context, *normalizeContext) ([]model.MatchedResult, error)) ([]model.MatchedResult, error) {
	results, err := tryFunc(ctx, nctx)
	if err != nil {
		return nil, err
	}
	if results != nil {
		return results, nil
	}
	return n.handleFallback(ctx, nctx)
}

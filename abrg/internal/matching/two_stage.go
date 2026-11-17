package matching

import (
	"context"
	"strings"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// tryTwoStageResidential attempts residential normalization using TwoStageSearch.
// Returns results with unmatched_address set, or nil if not found.
func (n *Impl) tryTwoStageResidential(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	if len(nctx.State.BasicResults) == 0 {
		return nil, nil
	}

	basic := &nctx.State.BasicResults[0]
	if basic.IDs.MachiazaID == nil {
		return nil, nil
	}

	// Prepare search address: use HasChome to determine if chome adjustment is needed
	searchAddr := nctx.Input.SearchAddr
	chomeConverted := false
	if basic.Machiaza.HasChome {
		if converted, ok := convertedToChome(nctx.Input.SearchAddr); ok {
			searchAddr = converted
			chomeConverted = true
		}
	}

	// Skip residential search if this machiaza has no rsdtdsp data (optimization)
	// IMPORTANT: If has_chome is true and we converted to chome notation (e.g., "舞浜2@:11"),
	// we should NOT skip because rsdtdsp data may exist under the chome-specific machiaza_id
	// (e.g., 舞浜 base=0018000 has rsdtdsp_count=0, but 舞浜2丁目=0018002 has rsdtdsp data)
	if basic.Machiaza.RsdtdspCount == 0 && !chomeConverted {
		return nil, nil
	}

	results, err := n.twoStageSearch.normalizeWithBasic(
		ctx, model.CategoryResidential, nctx.State.BasicResults, searchAddr,
	)
	if err != nil {
		return nil, err
	}
	if results != nil {
		for i := range results {
			setTwoStageUnmatchedAddress(&results[i], nctx.Input.NormalizedAddr, searchAddr)
		}
		return results, nil
	}

	return nil, nil
}

// tryTwoStageParcel attempts parcel normalization using TwoStageSearch.
// Returns results with unmatched_address set, or nil if not found.
func (n *Impl) tryTwoStageParcel(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	if len(nctx.State.BasicResults) == 0 {
		return nil, nil
	}

	basic := &nctx.State.BasicResults[0]
	if basic.IDs.MachiazaID == nil {
		return nil, nil
	}

	searchAddr := nctx.Input.SearchAddr.String()
	if basic.StructuredAddress.KyotoSt != nil {
		afterColon := strings.Join(nctx.Input.SearchAddr.Numbers, "-")
		searchAddr = buildSearchAddrWithoutKyotoSt(&basic.StructuredAddress, afterColon)
	}

	// finalize sets the unmatched address on each result.
	finalize := func(results []model.MatchedResult, usedSearchAddr parsedAddress) []model.MatchedResult {
		for i := range results {
			setTwoStageUnmatchedAddress(&results[i], nctx.Input.NormalizedAddr, usedSearchAddr)
		}
		return results
	}

	// For has_chome addresses without existing chome notation:
	// First try with chome adjustment (handles "南2条西1-5-2F" -> chome=1, parcel=5)
	// Then fall back to no adjustment (handles "舞浜2-11" -> parcel=2-11)
	// No chome follows a koaza (字四ッ屋80-9), so a koaza match is not adjusted.
	parsedSearchAddr := parseSearchAddr(searchAddr)
	if basic.Machiaza.HasChome && !parsedSearchAddr.HasChome && basic.StructuredAddress.Koaza == nil {
		adjusted := convertColonToChome(parsedSearchAddr)
		adjustedSearchAddr := adjusted.String()
		if adjustedSearchAddr != searchAddr {
			results, err := n.twoStageSearch.normalizeWithBasic(
				ctx, model.CategoryParcel, nctx.State.BasicResults, adjusted,
			)
			if err != nil {
				return nil, err
			}
			if results != nil {
				return finalize(results, adjusted), nil
			}
		}
	}

	results, err := n.twoStageSearch.normalizeWithBasic(
		ctx, model.CategoryParcel, nctx.State.BasicResults, parsedSearchAddr,
	)
	if err != nil {
		return nil, err
	}
	if results != nil {
		return finalize(results, parsedSearchAddr), nil
	}

	return nil, nil
}

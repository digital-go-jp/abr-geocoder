package matching

import (
	"context"
	"strings"

	"abrg/internal/model"
	"abrg/internal/transform"
)

// tryTwoStageResidential attempts residential normalization using TwoStageSearch.
// Returns results with unmatched_address set, or nil if not found.
func (n *Impl) tryTwoStageResidential(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	if len(nctx.State.BasicResults) == 0 || n.twoStageSearch == nil {
		return nil, nil
	}

	basic := &nctx.State.BasicResults[0]
	if basic.IDs.MachiazaID == nil {
		return nil, nil
	}

	// Prepare search address: use HasChome to determine if chome adjustment is needed
	searchAddr := nctx.Input.SearchAddr
	chomeConverted := false
	if basic.IDs.HasChome {
		converted := convertColonToChome(nctx.Input.SearchAddr)
		if converted.HasChome != nctx.Input.SearchAddr.HasChome {
			searchAddr = converted
			chomeConverted = true
		}
	}

	// Skip residential search if this machiaza has no rsdtdsp data (optimization)
	// IMPORTANT: If has_chome is true and we converted to chome notation (e.g., "舞浜2@:11"),
	// we should NOT skip because rsdtdsp data may exist under the chome-specific machiaza_id
	// (e.g., 舞浜 base=0018000 has rsdtdsp_count=0, but 舞浜2丁目=0018002 has rsdtdsp data)
	if basic.IDs.RsdtdspCount == 0 && !chomeConverted {
		return nil, nil
	}

	searchAddrStr := searchAddr.String()
	results, err := n.twoStageSearch.normalizeWithBasic(
		ctx, model.CategoryResidential, nctx.State.BasicResults, searchAddrStr,
	)
	if err != nil {
		return nil, err
	}
	if results != nil {
		for i := range results {
			setTwoStageUnmatchedAddress(&results[i], nctx.Input.StandardizedAddr, searchAddrStr)
		}
		return results, nil
	}

	return nil, nil
}

// tryTwoStageParcel attempts parcel normalization using TwoStageSearch.
// Returns results with unmatched_address set, or nil if not found.
func (n *Impl) tryTwoStageParcel(ctx context.Context, nctx *normalizeContext) ([]model.MatchedResult, error) {
	if len(nctx.State.BasicResults) == 0 || n.twoStageSearch == nil {
		return nil, nil
	}

	basic := &nctx.State.BasicResults[0]
	if basic.IDs.MachiazaID == nil {
		return nil, nil
	}

	searchAddr := nctx.Input.SearchAddr.String()
	if basic.StructuredAddress.KyotoSt != nil {
		afterColon := strings.Join(nctx.Input.SearchAddr.Numbers, "-")
		searchAddr = transform.BuildSearchAddrWithoutKyotoSt(&basic.StructuredAddress, afterColon)
	}

	// Skip parcel search if this machiaza has no parcel data and machiaza_id ends with "000"
	// (no base record to fallback to)
	parcelCount := basic.IDs.ParcelCount
	machiazaID := *basic.IDs.MachiazaID
	if parcelCount == 0 && model.IsBaseMachiazaID(machiazaID) {
		// For has_chome=true, parcel data may exist under the chome-specific machiaza_id
		// so we continue to search with chome adjustment
		if !basic.IDs.HasChome {
			return nil, nil
		}
	}

	// finalize sets unmatched address and applies parcel-specific post-processing.
	finalize := func(results []model.MatchedResult, usedSearchAddr string) []model.MatchedResult {
		for i := range results {
			setTwoStageUnmatchedAddress(&results[i], nctx.Input.StandardizedAddr, usedSearchAddr)
		}
		transform.MergeKyotoStToResults(results, nctx.State.BasicResults)
		return results
	}

	// For has_chome addresses without existing chome notation:
	// First try with chome adjustment (handles "南2条西1-5-2F" -> chome=1, parcel=5)
	// Then fall back to no adjustment (handles "舞浜2-11" -> parcel=2-11)
	parsedSearchAddr := parseSearchAddr(searchAddr)
	if basic.IDs.HasChome && !parsedSearchAddr.HasChome {
		adjusted := convertColonToChome(parsedSearchAddr)
		adjustedSearchAddr := adjusted.String()
		if adjustedSearchAddr != searchAddr {
			results, err := n.twoStageSearch.normalizeWithBasic(
				ctx, model.CategoryParcel, nctx.State.BasicResults, adjustedSearchAddr,
			)
			if err != nil {
				return nil, err
			}
			if results != nil {
				return finalize(results, adjustedSearchAddr), nil
			}
		}
	}

	results, err := n.twoStageSearch.normalizeWithBasic(
		ctx, model.CategoryParcel, nctx.State.BasicResults, searchAddr,
	)
	if err != nil {
		return nil, err
	}
	if results != nil {
		return finalize(results, searchAddr), nil
	}

	return nil, nil
}

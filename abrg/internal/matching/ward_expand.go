package matching

import (
	"context"
	"strings"

	"abrg/internal/model"
)

// tryWardExpansion attempts to resolve a ward-only address by prepending candidate city names.
// For example, "中区本町" is expanded to "横浜市中区本町", "名古屋市中区本町", etc.
// Returns all matching results from all candidate cities, allowing downstream limit to control output.
func (n *Impl) tryWardExpansion(ctx context.Context, searchAddrBase, searchAddrWithColon, originalAddr string) ([]model.MatchedResult, string, string, error) {
	if n.wardCandidates == nil {
		return nil, "", "", nil
	}

	ward := extractWardPrefix(searchAddrBase)
	if ward == "" {
		return nil, "", "", nil
	}

	candidates := n.wardCandidates[ward]
	if len(candidates) == 0 {
		return nil, "", "", nil
	}

	remainder := searchAddrBase[len(ward):]
	_, afterColon, hasColon := strings.Cut(searchAddrWithColon, ":")

	var allResults []model.MatchedResult
	var firstAddr, firstPref string

	for _, c := range candidates {
		expanded := c.CityWard + remainder
		results, modAddr, err := detectMachiaza(ctx, n.repo, expanded, model.All, originalAddr)
		if err != nil {
			return nil, "", "", err
		}
		if len(results) == 0 {
			continue
		}
		allResults = append(allResults, results...)
		if firstAddr == "" {
			// When DetectMachiaza returns empty modAddr (normal base match without colon/hyphen),
			// use the expanded address as the base for search address construction.
			base := modAddr
			if base == "" {
				base = expanded
			}
			if hasColon && afterColon != "" {
				firstAddr = base + ":" + afterColon
			} else {
				firstAddr = base
			}
			firstPref = c.PrefCode
		}
	}
	if len(allResults) == 0 {
		return nil, "", "", nil
	}
	return allResults, firstAddr, firstPref, nil
}

func extractWardPrefix(addr string) string {
	runes := []rune(addr)
	for i, r := range runes {
		if r == '区' && i > 0 {
			return string(runes[:i+1])
		}
	}
	return ""
}

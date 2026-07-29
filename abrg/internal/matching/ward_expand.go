package matching

import (
	"cmp"
	"context"
	"slices"

	"abrg/internal/matchlevel"
	"abrg/internal/model"
)

// tryWardExpansion retries a ward-only address with each candidate city name
// prepended, so that "中区本町" is also matched as "横浜市中区本町",
// "名古屋市中区本町" and so on. The prefix is added to the normalized address
// before text transformation, so the expanded address is transformed the same
// way as the column it is matched against, and each candidate runs through the
// whole matching path rather than an exact machiaza lookup alone.
//
// It returns nil unless a candidate matches more strongly than baseResults, so
// an address that already resolves on its own keeps its result.
func (n *Impl) tryWardExpansion(
	ctx context.Context,
	query model.MatchQuery,
	normalizedAddr string,
	addressType model.NormalizeCategory,
	baseResults []model.MatchedResult,
) ([]model.MatchedResult, error) {
	// A caller-pinned prefecture would filter out every candidate city anyway.
	if n.wardCandidates == nil || (query.Pref != model.All && query.Pref != "") {
		return nil, nil
	}
	ward := extractWardPrefix(normalizedAddr)
	candidates := n.wardCandidates[ward]
	if len(candidates) == 0 {
		return nil, nil
	}

	base := strongestResult(baseResults)
	if base != nil && base.Score >= 1 &&
		matchlevel.Detail(base.MatchLevel) >= matchlevel.Detail(model.MatchLevelMachiaza) {
		return nil, nil
	}

	remainder := normalizedAddr[len(ward):]
	var results []model.MatchedResult
	for _, c := range candidates {
		r, err := n.matchNormalized(ctx, query, c.CityWard+remainder, addressType)
		if err != nil {
			return nil, err
		}
		results = append(results, r...)
	}

	best := strongestResult(results)
	if best == nil || (base != nil && compareStrength(*best, *base) >= 0) {
		return nil, nil
	}

	// Weaker candidates are other cities that happen to share the ward name,
	// not alternative readings of the input, so they are dropped.
	strongest := *best
	results = slices.DeleteFunc(results, func(r model.MatchedResult) bool {
		return compareStrength(r, strongest) > 0
	})
	slices.SortStableFunc(results, compareStrength)
	if len(results) > query.Limit {
		results = results[:query.Limit]
	}
	return results, nil
}

// compareStrength orders results from strongest to weakest: a higher score
// first, then a more detailed match level. Score comes first because a fuzzy
// match that reaches a deeper level is still a match on a different address.
func compareStrength(a, b model.MatchedResult) int {
	if c := cmp.Compare(b.Score, a.Score); c != 0 {
		return c
	}
	return cmp.Compare(matchlevel.Detail(b.MatchLevel), matchlevel.Detail(a.MatchLevel))
}

// strongestResult returns the strongest result, or nil when there is none.
func strongestResult(results []model.MatchedResult) *model.MatchedResult {
	var best *model.MatchedResult
	for i := range results {
		if best == nil || compareStrength(results[i], *best) < 0 {
			best = &results[i]
		}
	}
	return best
}

// extractWardPrefix returns the leading part of addr up to and including the
// first "区", which is empty when addr contains none.
func extractWardPrefix(addr string) string {
	runes := []rune(addr)
	for i, r := range runes {
		if r == '区' && i > 0 {
			return string(runes[:i+1])
		}
	}
	return ""
}

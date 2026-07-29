package matching

import (
	"context"
	"slices"
	"strings"

	"abrg/internal/cache"
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
	if query.Pref != model.All && query.Pref != "" {
		return nil, nil
	}
	// An exact match down to the machiaza leaves nothing for another city to
	// improve on, and every candidate costs a further pass over the matching path.
	base, hasBase := strongestResult(baseResults)
	if hasBase && base.Score >= 1 &&
		matchlevel.Detail(base.MatchLevel) >= matchlevel.Detail(model.MatchLevelMachiaza) {
		return nil, nil
	}

	ward := extractWardPrefix(normalizedAddr)
	candidates := n.wardCandidates[ward]
	if len(candidates) == 0 {
		return nil, nil
	}

	remainder := normalizedAddr[len(ward):]

	// Only a candidate whose machiaza is absent reaches the Levenshtein search,
	// which costs several times an exact lookup. Run every candidate without it
	// first; when one resolves a machiaza, the others cannot do better.
	results, err := n.runWardCandidates(ctx, query, candidates, remainder, addressType, true)
	if err != nil {
		return nil, err
	}
	if !slices.ContainsFunc(results, reachedMachiaza) {
		results, err = n.runWardCandidates(ctx, query, candidates, remainder, addressType, false)
		if err != nil {
			return nil, err
		}
	}

	best, ok := strongestResult(results)
	if !ok || (hasBase && compareResultStrength(best, base) >= 0) {
		return nil, nil
	}

	// Weaker candidates are other cities that happen to share the ward name,
	// not alternative readings of the input, so they are dropped.
	results = slices.DeleteFunc(results, func(r model.MatchedResult) bool {
		return compareResultStrength(r, best) > 0
	})
	return sortAndLimitResults(results, query.Limit), nil
}

// runWardCandidates matches the address once per candidate city and returns
// every result. skipLevenshtein leaves out the Levenshtein search.
func (n *Impl) runWardCandidates(
	ctx context.Context,
	query model.MatchQuery,
	candidates []cache.WardCandidate,
	remainder string,
	addressType model.NormalizeCategory,
	skipLevenshtein bool,
) ([]model.MatchedResult, error) {
	var results []model.MatchedResult
	for _, c := range candidates {
		r, err := n.matchNormalized(ctx, query, c.CityWard+remainder, addressType, skipLevenshtein)
		if err != nil {
			return nil, err
		}
		results = append(results, r...)
	}
	return results, nil
}

// reachedMachiaza reports whether a result resolved a machiaza or deeper.
func reachedMachiaza(r model.MatchedResult) bool {
	return matchlevel.Detail(r.MatchLevel) >= matchlevel.Detail(model.MatchLevelMachiaza)
}

// extractWardPrefix returns the leading part of addr up to and including the
// first "区", which is empty when addr contains none.
func extractWardPrefix(addr string) string {
	if i := strings.Index(addr, "区"); i > 0 {
		return addr[:i+len("区")]
	}
	return ""
}

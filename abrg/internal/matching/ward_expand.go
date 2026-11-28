package matching

import (
	"context"
	"slices"
	"strings"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/matchlevel"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/transform"
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
	// The dictionary is keyed by the normalized ward name, so that ケ, ヶ and ガ
	// spellings of 保土ケ谷区 all reach it.
	wardKey, _ := transform.TextForDB(ward)
	candidates := n.wardCandidates[wardKey]
	if len(candidates) == 0 {
		return nil, nil
	}

	addrs := make([]string, len(candidates))
	for i, c := range candidates {
		addrs[i] = c.CityWard + normalizedAddr[len(ward):]
	}

	// Only a candidate whose machiaza is absent reaches the Levenshtein search,
	// which costs several times an exact lookup. Run every candidate without it
	// first; when one resolves a machiaza, the others cannot do better.
	results, err := n.matchEach(ctx, query, addrs, addressType, true)
	if err != nil {
		return nil, err
	}
	if !slices.ContainsFunc(results, reachedMachiaza) {
		results, err = n.matchEach(ctx, query, addrs, addressType, false)
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
	return sortAndLimitResults(dropWeaker(results, best), query.Limit), nil
}

// tryWardInsertion retries an address that names a designated city but not
// its ward with each of the city's wards put after the city name, so that
// "熊本市上熊本1丁目" is matched as "熊本市西区上熊本1丁目".
// Only a ward whose machiaza matches exactly counts.
//
// It returns nil unless baseResults stop at such a city and exactly one ward
// resolves a machiaza.
func (n *Impl) tryWardInsertion(
	ctx context.Context,
	query model.MatchQuery,
	normalizedAddr string,
	addressType model.NormalizeCategory,
	baseResults []model.MatchedResult,
) ([]model.MatchedResult, error) {
	base, ok := strongestResult(baseResults)
	if !ok || base.MatchLevel != model.MatchLevelCity || base.StructuredAddress.Ward != nil {
		return nil, nil
	}
	sa := base.StructuredAddress
	city := derefString(sa.City)
	cityWards := n.cityWards[derefString(sa.Pref)+city]
	head, rest, found := strings.Cut(normalizedAddr, city)
	if len(cityWards) == 0 || !found || rest == "" {
		return nil, nil
	}

	addrs := make([]string, len(cityWards))
	for i, cityWard := range cityWards {
		addrs[i] = head + cityWard + rest
	}
	results, err := n.matchEach(ctx, query, addrs, addressType, true)
	if err != nil {
		return nil, err
	}
	results = slices.DeleteFunc(results, func(r model.MatchedResult) bool {
		return !reachedMachiaza(r)
	})

	best, ok := strongestResult(results)
	if !ok {
		return nil, nil
	}
	results = dropWeaker(results, best)
	// A town found in more than one ward (新栄3丁目 in 千種区, 中区 and 東区)
	// leaves the ward undecided, so the address stays at the city.
	if slices.ContainsFunc(results, func(r model.MatchedResult) bool {
		return derefString(r.IDs.LgCode) != derefString(best.IDs.LgCode)
	}) {
		return nil, nil
	}
	return sortAndLimitResults(results, query.Limit), nil
}

// matchEach matches each of addrs and returns every result.
// skipLevenshtein leaves out the Levenshtein search.
func (n *Impl) matchEach(
	ctx context.Context,
	query model.MatchQuery,
	addrs []string,
	addressType model.NormalizeCategory,
	skipLevenshtein bool,
) ([]model.MatchedResult, error) {
	var results []model.MatchedResult
	for _, addr := range addrs {
		r, err := n.matchNormalized(ctx, query, addr, addressType, skipLevenshtein)
		if err != nil {
			return nil, err
		}
		results = append(results, r...)
	}
	return results, nil
}

// dropWeaker removes the results weaker than best.
func dropWeaker(results []model.MatchedResult, best model.MatchedResult) []model.MatchedResult {
	return slices.DeleteFunc(results, func(r model.MatchedResult) bool {
		return compareResultStrength(r, best) > 0
	})
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

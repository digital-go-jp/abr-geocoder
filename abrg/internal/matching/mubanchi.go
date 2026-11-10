package matching

import (
	"context"
	"strings"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// mubanchi states that a place has no lot number (無番地).
const mubanchi = "無番地"

// tryWithoutMubanchi retries an address ending in 無番地 without it, so that
// "差木地字クダッチ無番地" matches the koaza 字クダッチ and reports 無番地 as
// unmatched. Some machiaza carry 無番地 in their name (青ヶ島村無番地), so the
// retry runs only when the whole address left something unmatched.
//
// It returns nil when the retry does not apply or matches more weakly than
// baseResults.
func (n *Impl) tryWithoutMubanchi(
	ctx context.Context,
	query model.MatchQuery,
	normalizedAddr string,
	addressType model.NormalizeCategory,
	baseResults []model.MatchedResult,
) ([]model.MatchedResult, error) {
	stripped, ok := strings.CutSuffix(normalizedAddr, mubanchi)
	stripped = strings.TrimSpace(stripped)
	if !ok || stripped == "" {
		return nil, nil
	}
	base, hasBase := strongestResult(baseResults)
	if hasBase && len(base.UnmatchedAddress) == 0 {
		return nil, nil
	}

	results, err := n.matchNormalized(ctx, query, stripped, addressType, false)
	if err != nil {
		return nil, err
	}
	best, ok := strongestResult(results)
	if !ok || (hasBase && compareResultStrength(best, base) > 0) {
		return nil, nil
	}

	for i := range results {
		results[i].UnmatchedAddress = append(results[i].UnmatchedAddress, mubanchi)
	}
	return results, nil
}

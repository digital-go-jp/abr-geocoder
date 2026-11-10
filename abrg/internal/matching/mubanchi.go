package matching

import (
	"context"
	"strings"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// mubanchi states that a place has no lot number (無番地).
const mubanchi = "無番地"

// cutMubanchi removes 無番地 from the end of the address part, which is
// everything before the first space; what follows the space is a building
// name or a note, and 無番地 there belongs to it.
func cutMubanchi(normalizedAddr string) (string, bool) {
	addrPart, rest, _ := strings.Cut(normalizedAddr, " ")
	stripped, ok := strings.CutSuffix(addrPart, mubanchi)
	if !ok || stripped == "" {
		return "", false
	}
	if rest != "" {
		stripped += " " + rest
	}
	return stripped, true
}

// tryWithoutMubanchi retries an address whose address part ends in 無番地
// without it, so that "差木地字クダッチ無番地" matches the koaza 字クダッチ and
// reports 無番地 as unmatched. Some machiaza carry 無番地 in their name
// (青ヶ島村無番地), so the retry runs only when the whole address did not match
// exactly.
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
	stripped, ok := cutMubanchi(normalizedAddr)
	if !ok {
		return nil, nil
	}
	base, hasBase := strongestResult(baseResults)
	if hasBase && base.Score >= 1 && len(base.UnmatchedAddress) == 0 {
		return nil, nil
	}

	results, err := n.matchWithWardExpansion(ctx, query, stripped, addressType)
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

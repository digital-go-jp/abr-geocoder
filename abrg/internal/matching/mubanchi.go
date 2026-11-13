package matching

import (
	"context"
	"strings"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// mubanchi states that a place has no lot number (無番地).
const mubanchi = "無番地"

// splitMubanchi puts a space before 無番地 at the end of the address part,
// which is everything before the first space, so that 無番地 is matched as the
// text after the address and reported as unmatched ahead of any building name.
// 無番地 after the first space belongs to a building name or a note.
func splitMubanchi(normalizedAddr string) (string, bool) {
	addrPart, rest, hasRest := strings.Cut(normalizedAddr, " ")
	stripped, ok := strings.CutSuffix(addrPart, mubanchi)
	if !ok || stripped == "" {
		return "", false
	}
	split := stripped + " " + mubanchi
	if hasRest {
		split += " " + rest
	}
	return split, true
}

// tryWithoutMubanchi retries an address whose address part ends in 無番地 with
// 無番地 split off, so that "差木地字クダッチ無番地" matches the koaza 字クダッチ
// and reports 無番地 as unmatched. Some machiaza carry 無番地 in their name
// (青ヶ島村無番地), so the retry is skipped when the match already holds it.
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
	split, ok := splitMubanchi(normalizedAddr)
	if !ok {
		return nil, nil
	}
	base, hasBase := strongestResult(baseResults)
	if hasBase && strings.Contains(base.MatchedAddress, mubanchi) {
		return nil, nil
	}

	results, err := n.matchWithWardExpansion(ctx, query, split, addressType)
	if err != nil {
		return nil, err
	}
	best, ok := strongestResult(results)
	if !ok || (hasBase && compareResultStrength(best, base) > 0) {
		return nil, nil
	}
	return results, nil
}

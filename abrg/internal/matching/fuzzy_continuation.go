package matching

import "abrg/internal/model"

// maxTownTypos is the number of single-character substitutions tolerated in a
// town name for the two-stage (residential/parcel) search to still run after a
// Levenshtein fallback.
const maxTownTypos = 1

// fuzzyMatchAllowsTwoStage reports whether the Levenshtein-matched town is a
// same-length substitution of the input town. In that case the number section
// sits at the same position as it would for an exact match, so the
// residential/parcel search can resolve it without misreading the digits.
// Insertions, deletions, or a digit absorbed into the town name (e.g.
// 福室字久保野2-5 → 福室字久保野二番) change the town's rune length and are
// rejected, keeping the default skip that guards against boundary shifts. See #246.
func (n *Impl) fuzzyMatchAllowsTwoStage(nctx *normalizeContext) bool {
	if len(nctx.State.BasicResults) == 0 {
		return false
	}
	inputTown := n.townPortion(nctx.Input.SearchAddr.Base)
	matchedTown := n.townPortion(nctx.State.BasicResults[0].MatchedAddress)
	if inputTown == "" || matchedTown == "" {
		return false
	}
	return isPureSubstitution(inputTown, matchedTown)
}

// townPortion returns the address portion after the city/ward boundary.
func (n *Impl) townPortion(addr string) string {
	end := n.cityBoundary.Find(addr)
	if end <= 0 || end >= len(addr) {
		return ""
	}
	return addr[end:]
}

// isPureSubstitution reports whether a and b have the same rune length and
// differ in at most maxTownTypos positions (i.e. no insertions or deletions).
func isPureSubstitution(a, b string) bool {
	ra, rb := []rune(a), []rune(b)
	if len(ra) == 0 || len(ra) != len(rb) {
		return false
	}
	diff := 0
	for i := range ra {
		if ra[i] != rb[i] {
			diff++
			if diff > maxTownTypos {
				return false
			}
		}
	}
	return true
}

// capScoresToFuzzy lowers each result's score to fuzzyScore when it exceeds it,
// so a detail resolved from a fuzzy (sub-1.0) town match never outranks an exact
// match.
func capScoresToFuzzy(results []model.MatchedResult, fuzzyScore float64) {
	for i := range results {
		if results[i].Score > fuzzyScore {
			results[i].Score = fuzzyScore
		}
	}
}

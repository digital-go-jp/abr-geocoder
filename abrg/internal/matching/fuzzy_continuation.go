package matching

import (
	"slices"
	"strings"

	"abrg/internal/model"
	"abrg/internal/transform"
	"abrg/internal/util"
)

// maxTownTypos is the number of single-character substitutions tolerated in a
// town name for the two-stage (residential/parcel) search to still run after a
// Levenshtein fallback.
const maxTownTypos = 1

// fuzzyMatchAllowsTwoStage reports whether the Levenshtein-matched town lets the
// residential/parcel search resolve the number section. parcelPrefix is set when
// the town is short of the input by exactly that parcel-number prefix, which
// implies allowed.
//
// A same-length substitution leaves the number section where an exact match
// would put it, so the digits cannot be misread. Insertions, deletions, or a
// digit absorbed into the town name (e.g. 福室字久保野2-5 → 福室字久保野二番)
// change the town's rune length and are rejected, keeping the default skip that
// guards against boundary shifts. See #246.
//
// A parcel-number prefix (白浜町甲402) is the one length difference that is
// allowed: it is not a typo but part of the number that the parcel search puts
// back on.
func (n *Impl) fuzzyMatchAllowsTwoStage(nctx *normalizeContext) (allowed bool, parcelPrefix string) {
	if len(nctx.State.BasicResults) == 0 {
		return false, ""
	}
	best := &nctx.State.BasicResults[0]
	inputTown := n.townPortion(nctx.Input.SearchAddr.Base)
	matchedTown := n.townPortion(best.MatchedAddress)
	if inputTown == "" || matchedTown == "" {
		return false, ""
	}
	if prefix := nctx.Input.SearchAddr.parcelNumberPrefix(); prefix != "" &&
		strings.TrimSuffix(inputTown, prefix) == matchedTownName(best) {
		return true, prefix
	}
	return isPureSubstitution(inputTown, matchedTown), ""
}

// matchedTownName returns the town of a result in the form the search address
// holds it. The result carries the name as ABR registers it, 大字 and 字 markers
// and all, which the search address has had removed.
func matchedTownName(r *model.MatchedResult) string {
	name, _ := transform.TextForDB(derefString(r.StructuredAddress.OazaCho) + derefString(r.StructuredAddress.Koaza))
	return name
}

// consumedParcelPrefix reports whether the result is a parcel whose number starts
// with prefix, i.e. the prefix ended up in the answer rather than being dropped.
// Any of the kana spellings ABR records the prefix in counts as consumed.
func consumedParcelPrefix(results []model.MatchedResult, prefix string) bool {
	if len(results) == 0 || prefix == "" {
		return false
	}
	num1 := derefString(results[0].StructuredAddress.PrcNum1)
	return slices.ContainsFunc(util.KanaSpellings(prefix), func(s string) bool {
		return strings.HasPrefix(num1, s)
	})
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

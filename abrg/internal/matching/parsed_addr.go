package matching

import (
	"strings"
	"unicode/utf8"

	"abrg/internal/char"
	"abrg/internal/util"
)

// parsedAddress represents a structured version of the searchAddr string.
// It replaces the implicit `:@-space` string protocol with explicit fields.
//
// The original encoding uses:
//   - ":" to separate base address from number parts
//   - "@" to mark chome (before colon)
//   - "-" to separate number components
//   - " " (space) to separate building name
//
// Examples:
//
//	"港区虎ノ門:1-23-1"          -> Base="港区虎ノ門", Numbers=["1","23","1"]
//	"港区虎ノ門1@:6-5"           -> Base="港区虎ノ門", Chome="1", HasChome=true, Numbers=["6","5"]
//	"神田佐久間町2@:1 永島ビル9階" -> Base="神田佐久間町", Chome="2", HasChome=true, Numbers=["1"], Building="永島ビル9階"
//	"上尾市1@南:15-15"           -> Base="上尾市", Chome="1", HasChome=true, AfterChome="南", Numbers=["15","15"]
type parsedAddress struct {
	Base          string   // Town/city part (e.g., "港区虎ノ門")
	Chome         string   // Chome number if detected via "@" marker (e.g., "1")
	HasChome      bool     // Whether chome was detected via "@" marker
	AfterChome    string   // Text between "@" and ":" when oaza name continues after 丁目 (e.g., "南" in "壱丁目南")
	Numbers       []string // Number parts after colon (e.g., ["6", "5"])
	LeadingHyphen bool     // Whether numbers had a leading hyphen (e.g., ":-1" → Numbers=["1"], LeadingHyphen=true)
	Building      string   // Building name (part after space in number section)
}

func parseSearchAddr(searchAddr string) parsedAddress {
	p := parsedAddress{}
	if searchAddr == "" {
		return p
	}

	// Check for "@" marker (chome notation). Building names (after a space,
	// e.g., "港区虎ノ門:1 永島ビル9階") are split off in parseNumbersAndBuilding.
	if atIdx := strings.Index(searchAddr, "@"); atIdx > 0 {
		p.HasChome = true
		beforeAt := searchAddr[:atIdx]
		afterAt := searchAddr[atIdx+1:] // may start with ":" or be empty

		p.Chome = util.ExtractChomeDigits(beforeAt)
		if p.Chome != "" {
			// Base is everything before the chome digits
			p.Base = beforeAt[:len(beforeAt)-len(p.Chome)]
		} else {
			p.Base = beforeAt
		}

		if strings.HasPrefix(afterAt, ":") {
			afterColon := afterAt[1:]
			p.Numbers, p.LeadingHyphen, p.Building = parseNumbersAndBuilding(afterColon)
		} else if before, after, ok := strings.Cut(afterAt, ":"); ok {
			// Text between @ and : is part of the oaza name (e.g., "南" in "壱丁目南" → "1@南:15-15")
			p.AfterChome = before
			afterColon := after
			p.Numbers, p.LeadingHyphen, p.Building = parseNumbersAndBuilding(afterColon)
		} else if len(afterAt) > 1 && afterAt[0] == '-' && char.IsASCIIDigit(afterAt[1]) {
			// "@-N": the numbers follow the chome marker directly, as they do
			// when the input wrote the chome out and then a hyphen and
			// AddColon did not mark the boundary itself
			// (e.g. "銀座1丁目-5-2" -> "銀座1@-5-2").
			p.Numbers, p.LeadingHyphen, p.Building = parseNumbersAndBuilding(afterAt)
		}
	} else {
		// No "@" marker - simple "base:numbers" format
		base, afterColon, hasColon := strings.Cut(searchAddr, ":")
		p.Base = base
		if hasColon {
			p.Numbers, p.LeadingHyphen, p.Building = parseNumbersAndBuilding(afterColon)
		}
	}

	return p
}

func parseNumbersAndBuilding(afterColon string) ([]string, bool, string) {
	if afterColon == "" {
		return nil, false, ""
	}

	var building string

	leadingHyphen := strings.HasPrefix(afterColon, "-")
	if leadingHyphen {
		afterColon = afterColon[1:]
	}
	if afterColon == "" {
		return nil, false, ""
	}

	if idx := strings.Index(afterColon, " "); idx > 0 {
		building = afterColon[idx+1:]
		afterColon = afterColon[:idx]
	}

	parts := strings.Split(afterColon, "-")
	return parts, leadingHyphen, building
}

// String reconstructs the searchAddr string from the parsed fields.
// Used by functions that still accept string parameters (e.g., twoStageSearch, levenshtein).
func (p parsedAddress) String() string {
	if p.Base == "" {
		return ""
	}

	var sb strings.Builder
	sb.WriteString(p.Base)

	if p.HasChome {
		sb.WriteString(p.Chome)
		sb.WriteByte('@')
		sb.WriteString(p.AfterChome)
	}

	if len(p.Numbers) > 0 {
		sb.WriteByte(':')
		if p.LeadingHyphen {
			sb.WriteByte('-')
		}
		sb.WriteString(strings.Join(p.Numbers, "-"))
	}

	if p.Building != "" {
		sb.WriteByte(' ')
		sb.WriteString(p.Building)
	}

	return sb.String()
}

// parcelNumberPrefix returns the parcel-number prefix the base address ends
// with, or "" when it ends with anything else. An address writes the prefix
// between the town name and the digits, so it lands at the end of the base.
func (p parsedAddress) parcelNumberPrefix() string {
	last, size := utf8.DecodeLastRuneInString(p.Base)
	if size == 0 || !util.IsParcelNumberPrefix(last) {
		return ""
	}
	return string(last)
}

// numericParts returns the number components of the address, stopping at the
// first part that opens with neither a digit nor a branch character.
func (p parsedAddress) numericParts() []string {
	var numbers []string
	for i, part := range p.Numbers {
		component := numberComponent(part, i > 0)
		if component == "" {
			break
		}
		numbers = append(numbers, component)
	}
	return numbers
}

// numberComponent returns the number a part opens with: its digits, or, when a
// branch is allowed, the iroha ABR writes a branch number in followed by any
// digits (ロ in 6-ロ, ニ2 in 3872-ニ2). The first component of an address is
// never a branch, since an iroha in front of the digits belongs to the number
// itself and reaches here as a prefix on the base address instead.
func numberComponent(part string, allowBranch bool) string {
	if end := skipDigits(part, 0); end > 0 {
		return part[:end]
	}
	if !allowBranch {
		return ""
	}
	first, size := utf8.DecodeRuneInString(part)
	if size == 0 || !util.IsParcelNumberPrefix(first) {
		return ""
	}
	// A branch has to be the whole part. Taking it from the front of something
	// longer would read ロ棟, the name of a building, as the branch ロ.
	if end := skipDigits(part, size); end == len(part) {
		return part
	}
	return ""
}

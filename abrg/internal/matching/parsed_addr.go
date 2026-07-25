package matching

import (
	"strings"

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

	// Step 1: Extract building name (after space in the number portion).
	// The space may appear after the colon section, e.g., "港区虎ノ門:1 永島ビル9階"
	// But we need to handle it after splitting on colon.
	working := searchAddr

	// Step 2: Check for "@" marker (chome notation)
	if atIdx := strings.Index(working, "@"); atIdx > 0 {
		p.HasChome = true
		beforeAt := working[:atIdx]
		afterAt := working[atIdx+1:] // may start with ":" or be empty

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
			// Sapporo pattern: "@-N" where N is address number after chome
			// e.g., "北3条西1@-7" from expanded "北3西1-7" (ExpandSapporoJou + ChomeToSymbol)
			p.Numbers, p.LeadingHyphen, p.Building = parseNumbersAndBuilding(afterAt)
		}
	} else {
		// No "@" marker - simple "base:numbers" format
		base, afterColon, hasColon := strings.Cut(working, ":")
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

// Returns nil if no numbers are present.
func (p parsedAddress) numberParts() []string {
	if len(p.Numbers) == 0 {
		return nil
	}
	return p.Numbers
}

// numericParts returns only the numeric parts from the number components,
// equivalent to extractnumericParts.
// Filters out non-numeric parts and extracts leading digits from each part.
func (p parsedAddress) numericParts() []string {
	parts := p.numberParts()
	if parts == nil {
		return nil
	}

	var numbers []string
	for _, part := range parts {
		numEnd := 0
		for numEnd < len(part) && char.IsASCIIDigit(part[numEnd]) {
			numEnd++
		}
		if numEnd > 0 {
			numbers = append(numbers, part[:numEnd])
		} else {
			break
		}
	}
	return numbers
}

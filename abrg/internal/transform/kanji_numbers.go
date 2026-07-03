package transform

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	formalKanjiReplacer = strings.NewReplacer(
		"壱", "一", "弐", "二", "参", "三", "肆", "四", "伍", "五",
		"陸", "六", "漆", "七", "捌", "八", "玖", "九", "拾", "十",
	)

	// kanjiSegmentRe matches consecutive sequences of kanji numbers.
	// Each match is a contiguous segment to be processed as a unit.
	kanjiSegmentRe = regexp.MustCompile(`[一二三四五六七八九十百千万億零〇]+`)
)

var kanjiDigitValues = map[rune]int{
	'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
	'六': 6, '七': 7, '八': 8, '九': 9,
	'零': 0, '〇': 0,
}

var kanjiMultipliers = map[rune]int{
	'億': 100000000, '万': 10000, '千': 1000, '百': 100, '十': 10,
}

// kanjiDigitValue returns the numeric value for a kanji digit (一-九, 零, 〇).
// Returns (value, ok) where value is 0-9.
func kanjiDigitValue(r rune) (int, bool) {
	v, ok := kanjiDigitValues[r]
	return v, ok
}

// kanjiMultiplier returns the place value for 億, 万, 千, 百, 十.
// Returns (multiplier, ok) where multiplier is 10, 100, 1000, 10000, or 100000000.
func kanjiMultiplier(r rune) (int, bool) {
	v, ok := kanjiMultipliers[r]
	return v, ok
}

// evalKanjiNumber evaluates a kanji number sequence starting at position start in runes.
// It processes position-value structures like 百二十三 (323), 十二 (12), 千二百 (1200), 一万二千 (12000).
// Supports multipliers: 億 (100000000), 万 (10000), 千 (1000), 百 (100), 十 (10).
// Returns (value, runesConsumed). Returns (0, 0) if start is out of bounds or no valid sequence.
//
// Examples:
//
//	evalKanjiNumber([]rune("三百二十三号"), 0) → (323, 5)
//	evalKanjiNumber([]rune("千二百三"), 0) → (1203, 4)
//	evalKanjiNumber([]rune("十二"), 0) → (12, 2)
//	evalKanjiNumber([]rune("百"), 0) → (100, 1)
//	evalKanjiNumber([]rune("百番地"), 0) → (100, 1)
//	evalKanjiNumber([]rune("三五十"), 0) → (0, 0)  // not a position-structure
func evalKanjiNumber(runes []rune, start int) (int, int) {
	if start >= len(runes) {
		return 0, 0
	}

	r := runes[start]

	// evalKanjiNumber processes position-structure (倍数構造) patterns:
	// Valid forms:
	//   - Multiplier ONLY: 十, 百, 千 → (10, 1), (100, 1), (1000, 1)
	//   - Digit + Multiplier: 二十 → (20, 2)
	//   - Multiplier + Digit + Multiplier + Digit: 百二十三 → (123, 5)
	//
	// Invalid forms (return (0, 0)):
	//   - Digit ONLY: 九 → (0, 0)
	//   - Multiple Digits in sequence: 一二 → (0, 0), 九九十 (at start) → (0, 0)
	//
	// Key rule: If starting with a digit, the NEXT character must be a multiplier.
	// Otherwise, it's a simple digit sequence, not a position-structure.
	// Note: Non-multiplier characters following a multiplier stop the position-structure.
	// E.g., 千代 → (1000, 1) where 千 converts to 1000 and 代 stops processing.

	if _, isDigit := kanjiDigitValue(r); isDigit {
		// Starting with a digit: next must be a multiplier for this to be position-structure
		if start+1 >= len(runes) {
			return 0, 0 // digit alone
		}
		next := runes[start+1]
		if _, isMult := kanjiMultiplier(next); !isMult {
			return 0, 0 // digit followed by non-multiplier: simple digit sequence
		}
		// digit + multiplier: valid position-structure, continue processing
	} else if _, isMult := kanjiMultiplier(r); isMult {
		// Starting with a multiplier (千, 百, 十)
		// All multipliers are processed equally
	} else {
		// Not a digit or multiplier
		return 0, 0
	}

	// Now process the position-structure
	result, current := 0, 0
	lastWasMultiplier := false
	lastMultiplier := 0
	wasMultiplierChain := false
	for i := start; i < len(runes); i++ {
		r := runes[i]

		if d, ok := kanjiDigitValue(r); ok {
			// After a multiplier, if we see a digit, the next character must be a multiplier.
			// If another digit follows, it's invalid position-structure (e.g., 百二三 is invalid).
			if lastWasMultiplier && i+1 < len(runes) {
				if _, nextIsDigit := kanjiDigitValue(runes[i+1]); nextIsDigit {
					// Two consecutive digits after multiplier → invalid structure
					return 0, 0
				}
			}
			current = d
			lastWasMultiplier = false
			wasMultiplierChain = false
		} else if mult, ok := kanjiMultiplier(r); ok {
			// After a multiplier chain (e.g., 万 after 百), if we see a smaller multiplier,
			// it marks the end of the current position-structure group.
			// E.g., 千百十一万千百十一: after 万 (chain), 千 is smaller → stop here
			if wasMultiplierChain && mult < lastMultiplier {
				// End of current position-structure group after a multiplier chain
				return result + current, i - start
			}

			// Check if this multiplier is larger than the last one BEFORE setting implicit digit
			// This allows us to detect chains with accumulated values from digits
			if (lastWasMultiplier || current > 0) && lastMultiplier > 0 && mult > lastMultiplier {
				// Multiplier chain: multiply the accumulated value by this larger multiplier
				// E.g., 百万: result=100, current=0, mult=10000 → result = 100 × 10000
				// E.g., 千百十一万: result=1110, current=1, mult=10000 → result = (1110+1) × 10000
				result = (result + current) * mult
				current = 0
				wasMultiplierChain = true
			} else {
				// No chain: handle as regular position-structure
				if current == 0 {
					current = 1 // 百 alone = 100, 十 alone = 10
				}
				result += current * mult
				current = 0
				wasMultiplierChain = false
			}
			lastWasMultiplier = true
			lastMultiplier = mult
		} else {
			// Non-kanji-number character → stop
			return result + current, i - start
		}
	}

	return result + current, len(runes) - start
}

// convertKanjiSegment converts a segment of consecutive kanji numbers.
// The segment is treated as a single unit for evalKanjiNumber evaluation.
// If a position-structure pattern is found starting at position 0,
// that part is converted and the remainder is recursively processed.
// If no pattern is found, the entire segment is treated as individual digits/multipliers.
func convertKanjiSegment(seg string) string {
	runes := []rune(seg)
	value, consumed := evalKanjiNumber(runes, 0)

	if consumed > 0 {
		// Position-structure pattern found; convert and process remainder
		result := value
		if consumed < len(runes) {
			// Recursively process remaining characters
			remainderStr := convertKanjiSegment(string(runes[consumed:]))
			// Parse remainder as integer for numeric addition (e.g., 11110000 + 1111 = 11111111)
			remainderVal, err := strconv.Atoi(remainderStr)
			if err == nil {
				result += remainderVal
			} else {
				// If remainder contains non-numeric characters, concatenate
				return strconv.Itoa(result) + remainderStr
			}
		}
		return strconv.Itoa(result)
	}

	// No pattern at start; treat entire segment as individual digits/multipliers
	return kanjiRunesFallback(runes)
}

// kanjiRunesFallback converts each rune individually: kanji digits and
// multipliers become their arabic value, other runes pass through unchanged.
// Used when a rune sequence is not a well-formed positional kanji number.
func kanjiRunesFallback(runes []rune) string {
	var sb strings.Builder
	for _, r := range runes {
		if d, ok := kanjiDigitValue(r); ok {
			sb.WriteString(strconv.Itoa(d))
		} else if m, ok := kanjiMultiplier(r); ok {
			sb.WriteString(strconv.Itoa(m))
		} else {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

// KanjiToArabic converts kanji numbers to arabic numbers.
// Returns (converted string, whether any conversion occurred).
func KanjiToArabic(s string) (string, bool) {
	if !containsKanjiNumbers(s) {
		return s, false
	}

	orig := s

	// Normalize formal kanji to regular kanji
	s = formalKanjiReplacer.Replace(s)

	// Use regex to find and convert consecutive kanji number segments
	s = kanjiSegmentRe.ReplaceAllStringFunc(s, convertKanjiSegment)

	return s, s != orig
}

// containsKanjiNumbers checks if the string contains any kanji numbers.
func containsKanjiNumbers(s string) bool {
	// Fast path: check if string is ASCII-only (common case)
	for i := 0; i < len(s); i++ {
		if s[i] >= 0x80 {
			// Found non-ASCII, check for kanji numbers
			for _, r := range s[i:] {
				switch r {
				case '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
					'零', '〇', '百', '千',
					'壱', '弐', '参', '肆', '伍', '陸', '漆', '捌', '玖', '拾':
					return true
				}
			}
			return false
		}
	}
	// ASCII-only string, no kanji numbers
	return false
}

// kanjiPartToArabic converts a kanji number string to an arabic string.
// Used by kanjiNoToHyphen.
func kanjiPartToArabic(s string) string {
	runes := []rune(s)
	value, consumed := evalKanjiNumber(runes, 0)
	if consumed == len(runes) && consumed > 0 {
		return strconv.Itoa(value)
	}
	// If not a pure kanji number sequence, fallback to individual character conversion
	return kanjiRunesFallback(runes)
}

var (
	// kanjiNoKanjiPattern matches kanji number + ノ/の + kanji number.
	// e.g., "二ノ八" matches to convert to "2-8"
	kanjiNoKanjiPattern = regexp.MustCompile(`([一二三四五六七八九十百]+)[のノ]([一二三四五六七八九十百]+)`)

	// arabicNoKanjiPattern matches arabic number + ノ/の + kanji number for chained processing.
	// e.g., "8ノ一" matches to convert to "8-1" (after first pass converted "二ノ八" → "2-8")
	arabicNoKanjiPattern = regexp.MustCompile(`(\d+)[のノ]([一二三四五六七八九十百]+)`)

	// arabicNoArabicPattern matches arabic number + ノ/の + arabic number.
	// Handles fully-converted chained patterns like "2ノ8ノ1" and intermediate states
	// like "1-2ノ3-4" where both sides are already Arabic.
	arabicNoArabicPattern = regexp.MustCompile(`(\d+)[のノ](\d+)`)
)

// kanjiNoToHyphen converts kanji number + ノ/の + kanji number patterns to arabic-hyphen format.
// For example: "二ノ八ノ一" → "2-8-1", "十二ノ三" → "12-3"
// This should be called before AddressNumbersToHyphen since that function
// early-returns when there are no ASCII digits.
func kanjiNoToHyphen(s string) (string, bool) {
	// Early return if no の or ノ
	if !strings.Contains(s, "の") && !strings.Contains(s, "ノ") {
		return s, false
	}

	// Early return if no kanji numbers and no arabic-ノ-arabic pattern
	if !containsKanjiNumbers(s) && !arabicNoArabicPattern.MatchString(s) {
		return s, false
	}

	orig := s

	// First normalize formal kanji to regular kanji
	s = formalKanjiReplacer.Replace(s)

	// Repeatedly apply patterns to handle chained patterns like "二ノ八ノ一"
	// First pass: "二ノ八ノ一" → "2-8ノ一"
	// Second pass: "2-8ノ一" → "2-8-1" (using arabicNoKanjiPattern)
	for {
		newS := kanjiNoKanjiPattern.ReplaceAllStringFunc(s, func(match string) string {
			left, right := splitByNo(match)
			if right == "" {
				return match
			}
			return kanjiPartToArabic(left) + "-" + kanjiPartToArabic(right)
		})

		// Also apply arabicNoKanjiPattern for chained patterns
		newS = arabicNoKanjiPattern.ReplaceAllStringFunc(newS, func(match string) string {
			left, right := splitByNo(match)
			if right == "" {
				return match
			}
			// Left is already arabic, convert right kanji to arabic
			return left + "-" + kanjiPartToArabic(right)
		})

		// Apply arabicNoArabicPattern for fully-converted chained patterns (e.g., "2ノ3")
		newS = arabicNoArabicPattern.ReplaceAllString(newS, "$1-$2")

		if newS == s {
			break
		}
		s = newS
	}

	return s, s != orig
}

// splitByNo splits a string by ノ or の and returns the two parts.
// Returns empty right part if split fails.
func splitByNo(s string) (left, right string) {
	if l, r, ok := strings.Cut(s, "ノ"); ok {
		return l, r
	}
	if l, r, ok := strings.Cut(s, "の"); ok {
		return l, r
	}
	return s, ""
}

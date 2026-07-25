package normalize

import (
	"regexp"
	"strings"
	"unicode/utf8"

	"abrg/internal/char"
)

// =============================================================================
// Regex Patterns for Address Number Conversion
// =============================================================================

// -----------------------------------------------------------------------------
// Ban (番) patterns - block numbers
// -----------------------------------------------------------------------------

var (
	// banGaiWithBuilding handles: N番街 M号棟 -> N番街 M号棟 (keep)
	banGaiWithBuilding = regexp.MustCompile(`(\d+番街)\s*(\d+(?:号|棟))`)
	// banGai handles: N番街 -> N番街 (keep as is)
	banGai = regexp.MustCompile(`(\d+)番街`)
	// banSakiNotEnd handles: N番先+text -> N番先 text
	banSakiNotEnd = regexp.MustCompile(`(\d+番先)([^\s])`)
	// banGoWithAlphanumeric handles: N番M-[alphanumeric]号 -> N-M -[alphanumeric]
	banGoWithAlphanumeric = regexp.MustCompile(`(\d+)番(\d+)(-[A-Za-z][A-Za-z0-9]*)号`)
	// banGoShitsu handles: N番M-P号室 -> N-M -P号室
	banGoShitsu = regexp.MustCompile(`(\d+)番(\d+)-(\d+)号室`)
	// banGoSpace handles: N番M号+space -> N-M (keep space)
	banGoSpace = regexp.MustCompile(`(\d+)番(\d+(?:-\d+)*)号\s`)
	// banGoWithBuilding handles: N番M号+building -> N-M building
	banGoWithBuilding = regexp.MustCompile(`(\d+)番(\d+(?:-\d+)*)号([^\d\s])`)
	// banGoWithRoomNum handles: N番M号+room -> N-M room
	banGoWithRoomNum = regexp.MustCompile(`(\d+)番(\d+(?:-\d+)*)号(\d)`)
	// banNo handles: N番の/ノM -> N-M
	banNo = regexp.MustCompile(`(\d+)番[のノ](\d+)`)
	// banNoGo handles: N番MのO号 -> N-M-O
	banNoGo = regexp.MustCompile(`(\d+)番(\d+)[のノ](\d+)号`)
	// banTou handles: N番M棟 -> N M棟
	banTou = regexp.MustCompile(`(\d+)番(\d+)棟`)
	// banWithHyphenNumeric handles: N番M-[numeric] -> N-M-[numeric]
	banWithHyphenNumeric = regexp.MustCompile(`(\d+)番(\d+)(-\d+)`)
	// banWithHyphenAlphanumeric handles: N番M-[alphanumeric] -> N-M -[alphanumeric]
	banWithHyphenAlphanumeric = regexp.MustCompile(`(\d+)番(\d+)(-[A-Za-z][A-Za-z0-9]*)`)
	// banWithBuilding handles: N番M[building] -> N-M [building]
	banWithBuilding = regexp.MustCompile(`(\d+)番(\d+)([^\d\s-].*)`)
	// ban handles: N番M -> N-M (basic pattern)
	ban = regexp.MustCompile(`(\d+)番(\d+)`)
	// banOnly handles: N番 (at end) -> N
	banOnly = regexp.MustCompile(`(\d+)番$`)
	// banBuilding handles: N番+non-address-char -> N
	// Excludes: 街館先屋戸町地耕ケ川通丁内
	banBuilding = regexp.MustCompile(`(\d+)番([^\d街館先屋戸町地耕ケ川通丁内])`)
	// banHyphenGo handles: N番-M号 -> N-M
	banHyphenGo = regexp.MustCompile(`(\d+)番-(\d+)号`)
	// banHyphen handles: N番-M -> N-M (without 号)
	banHyphen = regexp.MustCompile(`(\d+)番-(\d+)`)
)

// -----------------------------------------------------------------------------
// Banchi (番地) patterns - lot numbers
// -----------------------------------------------------------------------------

var (
	// banchiGoTou handles incorrect format: N番地M号棟 -> N M号棟
	banchiGoTou = regexp.MustCompile(`(\d+)番地(\d+)号棟`)
	// banchiTou handles: N番地M棟 -> N M棟
	banchiTou = regexp.MustCompile(`(\d+)番地(\d+)棟`)
	// banchiGo handles incorrect format: N番地M号 -> N-M (remove 号)
	banchiGo = regexp.MustCompile(`(\d+)番地(\d+)号`)
	// banchiNo handles: N番地の/ノM -> N-M
	banchiNo = regexp.MustCompile(`(\d+)番地[のノ](\d+)`)
	// banchiNoGo handles: N番地の/ノM号 -> N-M
	banchiNoGo = regexp.MustCompile(`(\d+)番地[のノ](\d+)号`)
	// banchiHyphenGo handles: N番地-M号 -> N-M
	banchiHyphenGo = regexp.MustCompile(`(\d+)番地-(\d+)号`)
	// banchiHyphen handles: N番地-M -> N-M (without 号)
	banchiHyphen = regexp.MustCompile(`(\d+)番地-(\d+)`)
	// banchiWithHyphenNumeric handles: N番地M-P -> N-M-P
	banchiWithHyphenNumeric = regexp.MustCompile(`(\d+)番地(\d+)(-\d+)`)
	// banchiEnd handles: N番地M (at end) -> N-M
	banchiEnd = regexp.MustCompile(`(\d+)番地(\d+)$`)
	// banchiBuilding handles: N番地M+building -> N-M building
	banchiBuilding = regexp.MustCompile(`(\d+)番地(\d+)([^\d\s-])`)
	// banchiSakiNotEnd handles: N番地先+text -> N番地先 text
	banchiSakiNotEnd = regexp.MustCompile(`(\d+番地先)([^\s])`)
	// banchiSingleEnd handles: N番地 (at end) -> N
	banchiSingleEnd = regexp.MustCompile(`(\d+)番地$`)
	// banchiSingleNotEnd handles: N番地+non-digit -> N non-digit
	banchiSingleNotEnd = regexp.MustCompile(`(\d+)番地([^\d-先])`)
)

// -----------------------------------------------------------------------------
// Bancho (番町) patterns - town names ending with 番町
// -----------------------------------------------------------------------------

var (
	// bancho handles: 番町N+building -> 番町N building
	// Excludes: 号, F, 街, 階, 丁
	bancho = regexp.MustCompile(`(番町)(\d+)([^\d\s-号F街階丁])`)
	// banchoHyphenBuilding handles: 番町N-M+building -> 番町N-M building
	banchoHyphenBuilding = regexp.MustCompile(`(番町\d+-\d+)([^\d\s-号])`)
	// banchoBanchi handles: N番町M番地O -> N番町M-O
	banchoBanchi = regexp.MustCompile(`(\d+番町)(\d+)番地(\d+)`)
	// banchoBanGo handles: 番町N番M号 -> 番町N-M
	banchoBanGo = regexp.MustCompile(`(番町)(\d+)番(\d+)号`)
	// banchoBanWithNumber handles: 番町N番M -> 番町N-M
	banchoBanWithNumber = regexp.MustCompile(`(番町)(\d+)番(\d+)`)
	// banchoBanOnly handles: 番町N番+non-digit -> 番町N+non-digit
	banchoBanOnly = regexp.MustCompile(`(番町)(\d+)番([^\d])`)
	// banchoBanEnd handles: 番町N番 (at end) -> 番町N
	banchoBanEnd = regexp.MustCompile(`(番町)(\d+)番$`)
)

// -----------------------------------------------------------------------------
// Chome (丁目) patterns - district sub-sections
// -----------------------------------------------------------------------------

var (
	// chome handles: 丁目N番 (at end) -> 丁目N
	chome = regexp.MustCompile(`(丁目)(\d+)番$`)
	// chomeNotEnd handles: 丁目N番+non-address-char -> 丁目N
	// Excludes: の街先屋戸地
	chomeNotEnd = regexp.MustCompile(`(丁目)(\d+)番([^\dの街先屋戸地])`)
)

// -----------------------------------------------------------------------------
// Building/Room/Floor patterns
// -----------------------------------------------------------------------------

var (
	// gochi handles: N号地M -> N号地M (keep, add space if needed)
	gochi = regexp.MustCompile(`(\d+号地)(\d*)`)
	// roomNumber handles: N-N-M室 -> N-N -M室
	roomNumber = regexp.MustCompile(`(\d+(?:-\d+)+)-(\d+室)`)
	// floorNumber handles: N-N-MF/階 -> N-N -MF/階
	floorNumber = regexp.MustCompile(`(\d+(?:-\d+)*)-(\d+(?:F|階))`)
)

// -----------------------------------------------------------------------------
// Utility patterns
// -----------------------------------------------------------------------------

var (
	// firstArabic finds first N-N(-N)* pattern
	firstArabic = regexp.MustCompile(`([\d]+(?:-[\d]+)+)`)
	// spaceBeforeNo handles: space+の/ノ+digit
	spaceBeforeNo = regexp.MustCompile(` [のノ](\d+)`)
	// trailingGo handles: N-M...N号 (trailing 号)
	trailingGo = regexp.MustCompile(`(\d+-\d+(?:-\d+)*\d+)号$`)
	// numberBeforeJapanese handles: digit+Japanese-char
	numberBeforeJapanese = regexp.MustCompile(`(\d)([ァ-ヶぁ-ん一-龯])`)
)

// -----------------------------------------------------------------------------
// の/ノ patterns - for の-digit sequences
// -----------------------------------------------------------------------------

var (
	// digitNoDigitGo handles: digit+の/ノ+digit+号+non-digit
	// Groups: $1=digit, $2=の/ノ, $3=digits, $4=non-digit
	digitNoDigitGo = regexp.MustCompile(`(\d)([のノ])(\d+)号([^\d\s])`)
	// digitNoDigitGoEnd handles: digit+の/ノ+digit+号 (at end or space)
	// Groups: $1=digit, $2=の/ノ, $3=digits, $4=space/end
	digitNoDigitGoEnd = regexp.MustCompile(`(\d)([のノ])(\d+)号([\s]|$)`)
	// digitNoDigit handles: digit+の/ノ+digit+non-digit
	// Excludes 町 and 丁 to preserve special address formats
	// Groups: $1=digit, $2=の/ノ, $3=digits, $4=non-digit
	digitNoDigit = regexp.MustCompile(`(\d)([のノ])(\d+)([^\d\s号町丁])`)
	// digitNoDigitEnd handles: digit+の/ノ+digit (at end or space)
	// Groups: $1=digit, $2=の/ノ, $3=digits, $4=space/end
	digitNoDigitEnd = regexp.MustCompile(`(\d)([のノ])(\d+)([\s]|$)`)
)

// -----------------------------------------------------------------------------
// String lists for validation
// -----------------------------------------------------------------------------

// noSpaceComponents lists strings that should not have space separation after numbers.
var noSpaceComponents = []string{
	"街区", "丁目", "番地", "番", "号", "線", "地割", "分区", "基線", "条",
}

// addressComponents lists valid address component markers for addSpaceAfterNumberBeforeJapanese.
var addressComponents = []string{
	"丁目", "番地", "番丁", "番内", "番", "号", "棟", "階", "室", "線", "地割", "区", "街区", "条",
	"基線", "分区", "基北", "基南", "の通", "番通", "町内会", "林班", "字", "丁", "ノ町", "の町",
	"部", "本通", "本松", "本杉", "本柳", "本木", "の坪", "ノ坪", "ケ村", "ヶ村", "か村", "カ村",
}

// =============================================================================
// Functions
// =============================================================================

func hasASCIIDigit(s string) bool {
	for i := 0; i < len(s); i++ {
		if char.IsASCIIDigit(s[i]) {
			return true
		}
	}
	return false
}

// scanAddressMarkers scans the string once and returns whether any Japanese
// address marker is found and whether a floor pattern (digit followed by 'F') is found.
func scanAddressMarkers(s string) (hasMarker, hasFloor bool) {
	n := len(s)
	prevDigit := false
	for i := range n {
		b := s[i]
		// Check for 'F' preceded by digit (floor pattern like "5F")
		if b == 'F' && prevDigit {
			hasFloor = true
			if hasMarker {
				return
			}
		}
		prevDigit = char.IsASCIIDigit(b)

		// Check for Japanese characters (3-byte UTF-8)
		if i+2 >= n {
			continue
		}
		// Japanese address markers (UTF-8 encoded):
		// 番: E7 95 AA, 号: E5 8F B7, の: E3 81 AE, ノ: E3 83 8E
		// 室: E5 AE A4, 階: E9 9A 8E, 棟: E6 A3 9F, 町: E7 94 BA
		// 丁目: E4 B8 81 E7 9B AE (check as 6-byte sequence)
		switch b {
		case 0xE4:
			// 丁目 (E4 B8 81 E7 9B AE)
			if i+5 < n && s[i+1] == 0xB8 && s[i+2] == 0x81 &&
				s[i+3] == 0xE7 && s[i+4] == 0x9B && s[i+5] == 0xAE {
				hasMarker = true
				if hasFloor {
					return
				}
			}
		case 0xE7:
			if s[i+1] == 0x95 && s[i+2] == 0xAA { // 番
				hasMarker = true
				if hasFloor {
					return
				}
			} else if s[i+1] == 0x94 && s[i+2] == 0xBA { // 町
				hasMarker = true
				if hasFloor {
					return
				}
			}
		case 0xE5:
			if s[i+1] == 0x8F && s[i+2] == 0xB7 { // 号
				hasMarker = true
				if hasFloor {
					return
				}
			} else if s[i+1] == 0xAE && s[i+2] == 0xA4 { // 室
				hasMarker = true
				if hasFloor {
					return
				}
			}
		case 0xE3:
			if s[i+1] == 0x81 && s[i+2] == 0xAE { // の
				hasMarker = true
				if hasFloor {
					return
				}
			} else if s[i+1] == 0x83 && s[i+2] == 0x8E { // ノ
				hasMarker = true
				if hasFloor {
					return
				}
			}
		case 0xE9:
			if s[i+1] == 0x9A && s[i+2] == 0x8E { // 階
				hasMarker = true
				if hasFloor {
					return
				}
			}
		case 0xE6:
			if s[i+1] == 0xA3 && s[i+2] == 0x9F { // 棟
				hasMarker = true
				if hasFloor {
					return
				}
			}
		}
	}
	return
}

func preprocessRoomFloor(s string) string {
	// Handle room number pattern first (e.g., 17-10-202室 → 17-10 -202室)
	s = roomNumber.ReplaceAllString(s, "${1} -${2}")
	// Handle floor number pattern (e.g., 2-2-5-1F → 2-2-5 -1F, 5-3-5階 → 5-3 -5階)
	s = floorNumber.ReplaceAllString(s, "${1} -${2}")
	return s
}

// It returns the processed string and true if processing should stop.
func processIllegalBanchi(s string) (string, bool) {
	// N番地N号棟 (incorrect format but specific pattern)
	if next := banchiGoTou.ReplaceAllString(s, "${1} ${2}号棟"); next != s {
		return next, true
	}
	// N番地N棟 pattern (e.g., 1番地1棟301号 → 1 1棟301号)
	if next := banchiTou.ReplaceAllString(s, "${1} ${2}棟"); next != s {
		return next, true
	}
	// N番地N号 (incorrect format) should not be fully converted
	if next := banchiGo.ReplaceAllString(s, "${1}-${2}"); next != s {
		return next, true
	}
	return s, false
}

func processBanchi(s string) string {
	if strings.Contains(s, "番地") {
		s = banchiNoGo.ReplaceAllString(s, "${1}-${2}")                  // N番地の/ノM号 → N-M
		s = banchiNo.ReplaceAllString(s, "${1}-${2}")                    // N番地の/ノM → N-M
		s = banchiHyphenGo.ReplaceAllString(s, "${1}-${2}")              // N番地-M号 → N-M (remove 号)
		s = banchiHyphen.ReplaceAllString(s, "${1}-${2}")                // N番地-M → N-M (号なし)
		s = banchiWithHyphenNumeric.ReplaceAllString(s, "${1}-${2}${3}") // N番地M-P → N-M-P
		s = banchiBuilding.ReplaceAllString(s, "${1}-${2} ${3}")         // N番地M+建物名 → N-M 建物名
		s = banchiEnd.ReplaceAllString(s, "${1}-${2}")                   // N番地M (末尾) → N-M
		s = banchiSakiNotEnd.ReplaceAllString(s, "${1} ${2}")            // N番地先+後続文字 → N番地先 後続文字 (add space for building separation)
		s = banchiSingleEnd.ReplaceAllString(s, "${1}")                  // N番地（末尾） → N
		s = banchiSingleNotEnd.ReplaceAllString(s, "${1} ${2}")          // N番地（末尾ではない） → N 後続文字
	}
	if strings.Contains(s, "番-") {
		// Handle N番-N号 pattern (e.g., 11番-1004号 → 11-1004)
		s = banHyphenGo.ReplaceAllString(s, "${1}-${2}")
		// Handle N番-N pattern (without 号) (e.g., 1番-2 → 1-2)
		s = banHyphen.ReplaceAllString(s, "${1}-${2}")
	}
	return s
}

func processBancho(s string) string {
	// Handle N番町N番地M pattern first (e.g., 1番町188番地2 → 1番町188-2)
	s = banchoBanchi.ReplaceAllString(s, "${1}${2}-${3}")
	// Handle ○番町N番N号 pattern (e.g., 一番町9番8号 → 一番町9-8)
	s = banchoBanGo.ReplaceAllString(s, "${1}${2}-${3}")
	// Handle 番町 patterns (e.g., 二番町1番2 → 二番町1-2)
	s = banchoBanWithNumber.ReplaceAllString(s, "${1}${2}-${3}") // 番町N番M → 番町N-M
	s = banchoBanOnly.ReplaceAllString(s, "${1}${2}${3}")        // 番町N番[non-digit] → 番町N[non-digit]
	s = banchoBanEnd.ReplaceAllString(s, "${1}${2}")             // 番町N番 (at end) → 番町N
	// Handle 番町N-M[building] pattern (e.g., 番町9-10パークコート)
	s = banchoHyphenBuilding.ReplaceAllString(s, "${1} ${2}")
	return s
}

// AddressNumbersToHyphen converts address number patterns (番地, 番, 号) to hyphenated format.
func AddressNumbersToHyphen(s string) (string, bool) {
	original := s

	// Fast early return checks
	if !hasASCIIDigit(s) {
		return s, false
	}
	// Single scan for both address markers and floor pattern
	hasMarker, hasFloor := scanAddressMarkers(s)
	if !hasMarker && !hasFloor {
		return s, false
	}

	// Phase 1: Preprocess room/floor patterns
	s = preprocessRoomFloor(s)

	// Phase 2: Handle illegal banchi patterns (early return)
	if result, done := processIllegalBanchi(s); done {
		return result, result != original
	}

	// Phase 3-5: Process banchi/bancho/ban patterns (only if 番 exists)
	if strings.Contains(s, "番") {
		s = processBanchi(s)
		s = processBancho(s)
		s = processBan(s, original)
	}

	// Phase 6: Process の/ノ patterns (applies regardless of 番)
	s = processNoPatterns(s)

	// Phase 7: Process go patterns and postfix
	s = processGoAndPostfix(s)

	return s, s != original
}

// replaceBanGoEnd replaces "N番M号" at end of string with "N-M" without regex.
// This is an optimization for banGoEndPattern which was the most expensive regex.
func replaceBanGoEnd(s string) string {
	// Must end with 号
	if !strings.HasSuffix(s, "号") {
		return s
	}

	// Find 番 position
	banIdx := strings.LastIndex(s, "番")
	if banIdx < 1 {
		return s
	}

	// Check digit before 番
	if !char.IsASCIIDigit(s[banIdx-1]) {
		return s
	}

	// Find start of first number (before 番)
	numStart := banIdx - 1
	for numStart > 0 && char.IsASCIIDigit(s[numStart-1]) {
		numStart--
	}

	// Get the part between 番 and 号
	goIdx := len(s) - len("号")
	between := s[banIdx+len("番") : goIdx]

	// Validate: must be digits optionally with hyphens (e.g., "5", "5-3", "5-3-1")
	if len(between) == 0 || !char.IsASCIIDigit(between[0]) {
		return s
	}
	for i := 1; i < len(between); i++ {
		if !char.IsASCIIDigit(between[i]) && between[i] != '-' {
			return s
		}
	}

	// Build result: prefix + firstNum + "-" + between
	return s[:numStart] + s[numStart:banIdx] + "-" + between
}

func processBan(s, original string) string {
	// N番街, N番先 patterns - must come first (番屋敷, 番戸, 番館 are kept as-is by banBuilding exclusion)
	if strings.Contains(s, "番街") {
		if next := banGaiWithBuilding.ReplaceAllString(s, "${1} ${2}"); next != s {
			s = next
		} else {
			loc := banGai.FindStringIndex(s)
			if loc != nil && loc[0] > 0 {
				prevChar := s[loc[0]-1]
				if char.IsASCIIDigit(prevChar) {
					s = banGai.ReplaceAllString(s, "${1}番街 ")
				}
			}
		}
	}
	if strings.Contains(s, "番先") {
		s = banSakiNotEnd.ReplaceAllString(s, "${1} ${2}")
	}

	// N番M棟 patterns (building patterns)
	if strings.Contains(s, "棟") {
		s = banTou.ReplaceAllString(s, "${1} ${2}棟")
	}

	// N番N号 patterns with 号
	if strings.Contains(s, "号") {
		// N番MのO号 pattern - must come before banGoPattern
		s = banNoGo.ReplaceAllString(s, "${1}-${2}-${3}")
		s = banGoWithAlphanumeric.ReplaceAllString(s, "${1}-${2} ${3}")
		s = banGoShitsu.ReplaceAllString(s, "${1}-${2} -${3}号室")
		s = banGoWithBuilding.ReplaceAllString(s, "${1}-${2} ${3}") // N番M号+建物名 → N-M 建物名
		s = banGoWithRoomNum.ReplaceAllString(s, "${1}-${2} ${3}")  // N番M号+部屋番号 → N-M 部屋番号
		s = banGoSpace.ReplaceAllString(s, "${1}-${2} ")            // N番M号+スペース → N-M (スペース保持)
		s = replaceBanGoEnd(s)                                      // N番M号 (末尾) → N-M (optimized)
	}

	// N番の/ノN patterns
	if strings.Contains(s, "番の") || strings.Contains(s, "番ノ") {
		s = banNo.ReplaceAllString(s, "${1}-${2}")
	}

	// Handle chome pattern (丁目N番 → 丁目N)
	if strings.Contains(s, "丁目") {
		s = chome.ReplaceAllString(s, "${1}${2}")
		s = chomeNotEnd.ReplaceAllString(s, "${1}${2} ${3}")
	}

	// N番N patterns without 号 (only if not followed by 号 or 棟)
	// Use string-based checks instead of regex for better performance
	if !hasBanGoPattern(original) && !hasBanTouPattern(original) {
		if strings.Contains(s, "-") {
			s = banWithHyphenNumeric.ReplaceAllString(s, "${1}-${2}${3}")
			s = banWithHyphenAlphanumeric.ReplaceAllString(s, "${1}-${2} ${3}")
		}
		s = banWithBuilding.ReplaceAllString(s, "${1}-${2} ${3}")
		s = ban.ReplaceAllString(s, "${1}-${2}")
	}

	// N番 pattern (just 番 at end)
	if strings.HasSuffix(s, "番") {
		s = banOnly.ReplaceAllString(s, "${1}")
	}
	s = banBuilding.ReplaceAllString(s, "${1} ${2}")

	return s
}

func processNoPatterns(s string) string {
	// Skip if no の or ノ in string
	if !strings.ContainsAny(s, "のノ") {
		return s
	}

	// のN and ノN patterns
	// These patterns convert "番地の2" → "番地-2" but cause issues with:
	// 1. Place names ending with ノ (e.g., "アケボノ1丁目" → "アケボ-1丁目")
	// 2. Hokkaido koaza names with ノN (e.g., "南大沼ノ1" is registered as-is in DB)
	// Only apply conversion if preceded by a number (e.g., "7の2", "20の6号")
	// Remove space before の/ノ followed by digit (restore original format)
	s = spaceBeforeNo.ReplaceAllStringFunc(s, func(m string) string {
		// m is " の1" or " ノ1" - remove the leading space
		return m[1:] // skip the space
	})
	// Convert のN号/ノN号 and のN/ノN only when preceded by a digit
	// This handles cases like "7の2" → "7-2" but avoids "アケボノ1" → "アケボ-1"
	s = convertNoPatternAfterDigit(s)

	return s
}

// convertNoPatternAfterDigit converts のN/ノN patterns only when preceded by a digit.

func convertNoPatternAfterDigit(s string) string {
	// Handle "Nの/ノM号X" → "N-M X" (remove 号, add space before non-digit)
	s = digitNoDigitGo.ReplaceAllString(s, "${1}-${3} ${4}")
	// Handle "Nの/ノM号" at end/space → "N-M" (remove 号, preserve trailing)
	s = digitNoDigitGoEnd.ReplaceAllString(s, "${1}-${3}${4}")
	// Handle "Nの/ノMX" → "N-M X" (add space before non-digit)
	s = digitNoDigit.ReplaceAllString(s, "${1}-${3} ${4}")
	// Handle "Nの/ノM" at end → "N-M"
	s = digitNoDigitEnd.ReplaceAllString(s, "${1}-${3}${4}")
	return s
}

// hasBanGoPattern checks for pattern "数字+番+数字(ハイフン数字)*+号" without regex.
func hasBanGoPattern(s string) bool {
	// Quick check: must contain 号
	idx := strings.Index(s, "号")
	if idx < 1 {
		return false
	}

	// Find 番 before 号
	banIdx := strings.LastIndex(s[:idx], "番")
	if banIdx < 1 {
		return false
	}

	// Check for digit before 番
	lastRune, _ := utf8.DecodeLastRuneInString(s[:banIdx])
	if lastRune < '0' || lastRune > '9' {
		return false
	}

	// Check for digit after 番 (between 番 and 号)
	// The part between 番 and 号 should be digit(s) optionally followed by -digit(s)
	between := s[banIdx+len("番") : idx]
	if len(between) == 0 {
		return false
	}
	// First char must be digit
	return char.IsASCIIDigit(between[0])
}

// hasBanTouPattern checks for pattern "数字+番+数字+棟" without regex.
func hasBanTouPattern(s string) bool {
	// Quick check: must contain 棟
	idx := strings.Index(s, "棟")
	if idx < 1 {
		return false
	}

	// Check for digit before 棟
	lastRune, _ := utf8.DecodeLastRuneInString(s[:idx])
	if lastRune < '0' || lastRune > '9' {
		return false
	}

	// Find 番 before 棟
	banIdx := strings.LastIndex(s[:idx], "番")
	if banIdx < 1 {
		return false
	}

	// Check for digit before 番
	lastRuneBefore, _ := utf8.DecodeLastRuneInString(s[:banIdx])
	return char.IsASCIIDigit(lastRuneBefore)
}

func processGoAndPostfix(s string) string {
	// Remove trailing 号 for hyphenated address patterns
	if next := trailingGo.ReplaceAllString(s, "${1}"); next != s {
		s = next
	}

	// Handle 号地 pattern
	if next := gochi.ReplaceAllString(s, "${1}${2}"); next != s {
		s = next
	}

	// Handle ○番町 followed by building name
	if next := bancho.ReplaceAllString(s, "${1}${2} ${3}"); next != s {
		s = next
	}

	return s
}

// addSpaceAfterFirstArabicNumber adds a space after the first occurrence of arabic number-hyphen pattern (e.g., 1-2-3).
// This is used to split the address into base address and building name/room number.
func addSpaceAfterFirstArabicNumber(s string) (string, bool) {
	original := s

	// Find first occurrence of N-N(-N)* pattern
	loc := firstArabic.FindStringIndex(s)
	if loc == nil {
		return s, false
	}

	// Check if followed by an address component that should not be separated
	// e.g., "11-2街区" should stay as-is, not become "11-2 街区"
	if loc[1] < len(s) {
		afterMatch := s[loc[1]:]
		for _, comp := range noSpaceComponents {
			if len(afterMatch) >= len(comp) && afterMatch[:len(comp)] == comp {
				// Don't add space before these components
				return s, false
			}
		}
	}

	// Add space after the matched pattern if not already present
	if loc[1] < len(s) && s[loc[1]] != ' ' {
		s = s[:loc[1]] + " " + s[loc[1]:]
	}

	return s, s != original
}

// addSpaceAfterNumberBeforeJapanese adds a space after a number when it's followed by Japanese text.

func addSpaceAfterNumberBeforeJapanese(s string) (string, bool) {
	original := s

	pattern := numberBeforeJapanese
	for {
		matches := pattern.FindStringSubmatchIndex(s)
		if matches == nil {
			break
		}

		// Check if this is part of an address component
		isAddressComponent := false
		for _, comp := range addressComponents {
			// Check if the Japanese character is the start of an address component
			if matches[4] < len(s) && len(s[matches[4]:]) >= len(comp) {
				if s[matches[4]:matches[4]+len(comp)] == comp {
					isAddressComponent = true
					break
				}
			}
		}

		// Special case: の/ノ followed by digit (e.g., "本町6の1丁目")
		// This pattern is used in addresses like "本町6の1丁目" where 6の1 is a block number
		if !isAddressComponent && matches[4] < len(s) {
			afterNum := s[matches[4]:]
			runes := []rune(afterNum)
			if len(runes) >= 1 {
				if runes[0] == 'の' || runes[0] == 'ノ' {
					// Check if followed by digit
					if len(runes) >= 2 {
						if char.IsASCIIDigit(runes[1]) {
							isAddressComponent = true
						}
					}
					// Special case: address ending with Nの/Nノ (e.g., "天池町1の", "天池町1ノ")
					// These are valid koaza patterns in Ishikawa (e.g., "金沢市天池町1ノ")
					if len(runes) == 1 {
						isAddressComponent = true
					}
				}
			}
		}

		// Special case: kanji followed by digit followed by 丁目 (e.g., "東1北2丁目")
		// Pattern: 数字+漢字+数字+丁目 - don't add space between first digit and kanji
		// This handles Hokkaido Nakashibetsu-style addresses (e.g., "中標津町東1北2丁目")
		// and other similar patterns where kanji+digit+丁目 forms a single location identifier
		if !isAddressComponent && matches[4] < len(s) {
			afterNum := s[matches[4]:]
			runes := []rune(afterNum)
			if len(runes) >= 1 {
				firstRune := runes[0]
				// Check if it's a kanji (CJK Unified Ideographs range)
				if firstRune >= 0x4E00 && firstRune <= 0x9FFF {
					// Check if followed by digit and eventually 丁目
					if len(runes) >= 2 {
						secondRune := runes[1]
						if char.IsASCIIDigit(secondRune) {
							// Check if the pattern ends with 丁目
							if strings.Contains(afterNum, "丁目") {
								isAddressComponent = true
							}
						}
					}
				}
			}
		}

		if !isAddressComponent {
			// Add space between number and Japanese text
			s = s[:matches[3]] + " " + s[matches[3]:]
		} else {
			// Skip this match by replacing with a placeholder
			break
		}
	}

	return s, s != original
}

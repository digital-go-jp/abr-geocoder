package util

import (
	"regexp"
	"strconv"
	"strings"
)

// FilePatternType represents the type of ABR filename pattern.
type FilePatternType string

const (
	PatternAll     FilePatternType = "all"
	PatternPref    FilePatternType = "pref"
	PatternCity    FilePatternType = "city"
	PatternUnknown FilePatternType = "unknown"
)

var (
	prefPattern = regexp.MustCompile(`pref(\d+)(?:_pos)?`)
	cityPattern = regexp.MustCompile(`city(\d{6})(?:_pos)?`)
)

// FilePattern represents parsed filename pattern information.
type FilePattern struct {
	Type    FilePatternType
	Code    string // "13", "131001", etc.
	PrefNum int    // Prefecture number (1-47), 0 for "all" or "unknown"
}

// ParseFilePattern parses ABR filename and extracts pattern information.
// Examples:
//   - mt_pref_all.csv → {Type: "all", Code: "", PrefNum: 0}
//   - mt_town_pref13.csv → {Type: "pref", Code: "13", PrefNum: 13}
//   - mt_parcel_city131001.csv → {Type: "city", Code: "131001", PrefNum: 13}
//   - unknown.csv → {Type: "unknown", Code: "", PrefNum: 0}
func ParseFilePattern(fileName string) FilePattern {
	// "all" pattern (highest priority)
	if strings.Contains(fileName, "_all") {
		return FilePattern{Type: PatternAll}
	}

	// Prefecture pattern (e.g., mt_town_pref13.csv)
	// Regex guarantees digits only, so Atoi won't fail
	if matches := prefPattern.FindStringSubmatch(fileName); len(matches) > 1 {
		num, _ := strconv.Atoi(matches[1])
		return FilePattern{Type: PatternPref, Code: matches[1], PrefNum: num}
	}

	// City pattern (e.g., mt_parcel_city131001.csv) - first 2 digits are prefecture code
	// Regex guarantees 6 digits, so Atoi won't fail
	if matches := cityPattern.FindStringSubmatch(fileName); len(matches) > 1 {
		num, _ := strconv.Atoi(matches[1][:2])
		return FilePattern{Type: PatternCity, Code: matches[1], PrefNum: num}
	}

	return FilePattern{Type: PatternUnknown}
}

// ExtractLocationInfo extracts prefecture code and file key from filename.
// Returns (prefCode, fileKey) where:
//   - "all" pattern: (0, "all")
//   - pref pattern: (prefCode, prefCodeString) e.g., (13, "13")
//   - city pattern: (prefCode from first 2 digits, cityCode) e.g., (13, "131001")
//   - unknown: (0, "")
func ExtractLocationInfo(fileName string) (prefCode int, fileKey string) {
	p := ParseFilePattern(fileName)
	switch p.Type {
	case PatternAll:
		return 0, "all"
	case PatternPref, PatternCity:
		return p.PrefNum, p.Code
	default:
		return 0, ""
	}
}

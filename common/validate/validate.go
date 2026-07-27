// Package validate provides validation utilities for Japanese administrative codes.
package validate

import (
	"fmt"
	"strconv"
	"strings"
)

// Prefecture code boundaries for Japanese administrative regions.
const (
	minPrefectureCode = 1
	maxPrefectureCode = 47
)

func isValidPrefectureCode(code int) bool {
	return code >= minPrefectureCode && code <= maxPrefectureCode
}

// ParsePrefectureCode parses and validates a prefecture code string.
func ParsePrefectureCode(s string) (int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("empty prefecture code")
	}

	code, err := strconv.Atoi(s)
	if err != nil {
		return 0, fmt.Errorf("invalid prefecture code: %s", s)
	}

	if !isValidPrefectureCode(code) {
		return 0, fmt.Errorf("prefecture code %d out of range (%d-%d)", code, minPrefectureCode, maxPrefectureCode)
	}

	return code, nil
}

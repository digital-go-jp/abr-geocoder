package util

import "strings"

// StripChomeSuffix removes trailing "丁目" or "丁" from s.
// It returns s unchanged if no suffix is present.
func StripChomeSuffix(s string) string {
	s = strings.TrimSuffix(s, "丁目")
	return strings.TrimSuffix(s, "丁")
}

// StripGoSuffix removes trailing "号" or "字" from s.
// It returns s unchanged if no suffix is present.
// Note: "号" is removed first, then "字".
// e.g., "4号" -> "4", "10字" -> "10", "5" -> "5"
func StripGoSuffix(s string) string {
	s = strings.TrimSuffix(s, "号")
	return strings.TrimSuffix(s, "字")
}

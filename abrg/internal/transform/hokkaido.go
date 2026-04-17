package transform

// Hokkaido-specific address pattern handling.
// Hokkaido uses unique colonial division patterns (殖民地割) like "N線M号".

import (
	"regexp"
	"strings"
)

// senGoPattern matches Hokkaido colonial division addresses like "7線1号" or "10線西5号".
// This pattern is used to split "N線[方角]M号" into base ("N線[方角]") and suffix ("M号").
var senGoPattern = regexp.MustCompile(`^(.*\d+線[東西南北]?)(\d+号)$`)

// isHokkaidoSenPattern checks if the string ends with a Hokkaido line pattern (数字+線).
// e.g., "7線" returns true, "上条" returns false.
func isHokkaidoSenPattern(s string) bool {
	if !strings.HasSuffix(s, "線") {
		return false
	}
	runes := []rune(s)
	return len(runes) >= 2 && runes[len(runes)-2] >= '0' && runes[len(runes)-2] <= '9'
}

// IsSenGoPattern checks if the address contains Hokkaido sen-go pattern (N線:M号).
// e.g., "上川郡鷹栖町7線:1号" returns true
// e.g., "小松市軽海町ノ:14-1" returns false (regular hyphen pattern)
func IsSenGoPattern(addr string) bool {
	before, after, found := strings.Cut(addr, ":")
	if !found || after == "" {
		return false
	}
	if !strings.HasSuffix(before, "線") {
		return false
	}
	afterPart, _, _ := strings.Cut(after, "-")
	return strings.HasSuffix(afterPart, "号")
}

// ExtractSenGoSuffix extracts the 号 suffix from Hokkaido colonial division addresses.
// e.g., "上川郡鷹栖町7線1号" -> ("上川郡鷹栖町7線", "1号", true)
// e.g., "上川郡鷹栖町10線西5号" -> ("上川郡鷹栖町10線西", "5号", true)
// e.g., "上川郡鷹栖町7線" -> ("", "", false)
func ExtractSenGoSuffix(address string) (base, suffix string, found bool) {
	if matches := senGoPattern.FindStringSubmatch(address); matches != nil {
		return matches[1], matches[2], true
	}
	return "", "", false
}

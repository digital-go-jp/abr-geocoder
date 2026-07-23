package transform

import (
	"testing"
	"unicode/utf8"
)

func FuzzKanjiToArabic(f *testing.F) {
	testCases := []string{
		"一番地",
		"二丁目",
		"十番",
		"零号〇番",
		"一丁目二番三号",
		"123-456",
		"",
		"壱弐参肆伍陸漆捌玖拾",
	}

	for _, tc := range testCases {
		f.Add(tc)
	}

	f.Fuzz(func(t *testing.T, s string) {
		out, _ := KanjiToArabic(s)
		// If input is valid UTF-8, output must also be valid UTF-8
		if utf8.ValidString(s) && !utf8.ValidString(out) {
			t.Errorf("valid UTF-8 input produced invalid UTF-8 output: %q -> %q", s, out)
		}
	})
}

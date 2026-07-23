package normalize

import (
	"testing"
	"unicode/utf8"
)

func FuzzNFKCNormalize(f *testing.F) {
	testCases := []string{
		"東京都千代田区紀尾井町１−３",
		"１２３４５",
		"ＡＢＣａｂｃ",
		"ｱｲｳｴｵ",
		"test",
		"",
		"（１２３）－４５６",
	}

	for _, tc := range testCases {
		f.Add(tc)
	}

	f.Fuzz(func(t *testing.T, s string) {
		out, _ := NFKCNormalize(s)
		// If input is valid UTF-8, output must also be valid UTF-8
		if utf8.ValidString(s) && !utf8.ValidString(out) {
			t.Errorf("valid UTF-8 input produced invalid UTF-8 output: %q -> %q", s, out)
		}
	})
}

func FuzzNormalizeAddressText(f *testing.F) {
	testCases := []string{
		"東京都千代田区紀尾井町1番3号",
		"東京都千代田区紀尾井町１番３号",
		"東京都千代田区紀尾井町１－２－３",
		"東京都千代田区紀尾井町1ー2ー3",
		"",
		"東京都",
		"東京都千代田区紀尾井町1-2-3東京ガーデンテラス",
	}

	for _, tc := range testCases {
		f.Add(tc)
	}

	f.Fuzz(func(t *testing.T, s string) {
		out, _ := NormalizeAddressText(s)
		// If input is valid UTF-8, output must also be valid UTF-8
		if utf8.ValidString(s) && !utf8.ValidString(out) {
			t.Errorf("valid UTF-8 input produced invalid UTF-8 output: %q -> %q", s, out)
		}
	})
}

func FuzzNormalizeDashes(f *testing.F) {
	testCases := []string{
		"東京都千代田区紀尾井町",
		"1-2-3",
		"1－2－3",
		"1–2–3",
		"1—2—3",
		"1ー2ー3",
		"ガーデンテラス",
		"",
	}

	for _, tc := range testCases {
		f.Add(tc)
	}

	f.Fuzz(func(t *testing.T, s string) {
		out, _ := NormalizeDashes(s)
		// If input is valid UTF-8, output must also be valid UTF-8
		if utf8.ValidString(s) && !utf8.ValidString(out) {
			t.Errorf("valid UTF-8 input produced invalid UTF-8 output: %q -> %q", s, out)
		}
	})
}

func FuzzNormalizeSpaces(f *testing.F) {
	testCases := []string{
		"  東京都港区三田  ",
		"東京都　　港区　　　三田",
		"東京都港区三田3-3-3",
		"東京都\t\t港区\t\t\t三田",
		"",
		"   　　　   ",
	}

	for _, tc := range testCases {
		f.Add(tc)
	}

	f.Fuzz(func(t *testing.T, s string) {
		out, _ := NormalizeSpaces(s)
		// If input is valid UTF-8, output must also be valid UTF-8
		if utf8.ValidString(s) && !utf8.ValidString(out) {
			t.Errorf("valid UTF-8 input produced invalid UTF-8 output: %q -> %q", s, out)
		}
	})
}

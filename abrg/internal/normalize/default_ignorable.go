package normalize

import (
	"strings"
	"unicode"
)

// defaultIgnorable is Default_Ignorable_Code_Point from [DerivedCoreProperties.txt].
// The unicode package does not provide it.
// These characters are invisible, and an address containing one does not match.
//
// [DerivedCoreProperties.txt]: https://www.unicode.org/Public/17.0.0/ucd/DerivedCoreProperties.txt
var defaultIgnorable = &unicode.RangeTable{
	R16: []unicode.Range16{
		{Lo: 0x00AD, Hi: 0x00AD, Stride: 1},
		{Lo: 0x034F, Hi: 0x034F, Stride: 1},
		{Lo: 0x061C, Hi: 0x061C, Stride: 1},
		{Lo: 0x115F, Hi: 0x1160, Stride: 1},
		{Lo: 0x17B4, Hi: 0x17B5, Stride: 1},
		{Lo: 0x180B, Hi: 0x180F, Stride: 1},
		{Lo: 0x200B, Hi: 0x200F, Stride: 1},
		{Lo: 0x202A, Hi: 0x202E, Stride: 1},
		{Lo: 0x2060, Hi: 0x206F, Stride: 1},
		{Lo: 0x3164, Hi: 0x3164, Stride: 1},
		{Lo: 0xFE00, Hi: 0xFE0F, Stride: 1},
		{Lo: 0xFEFF, Hi: 0xFEFF, Stride: 1},
		{Lo: 0xFFA0, Hi: 0xFFA0, Stride: 1},
		{Lo: 0xFFF0, Hi: 0xFFF8, Stride: 1},
	},
	R32: []unicode.Range32{
		{Lo: 0x1BCA0, Hi: 0x1BCA3, Stride: 1},
		{Lo: 0x1D173, Hi: 0x1D17A, Stride: 1},
		{Lo: 0xE0000, Hi: 0xE0FFF, Stride: 1},
	},
}

// RemoveDefaultIgnorable removes every Default_Ignorable_Code_Point from s.
func RemoveDefaultIgnorable(s string) (string, bool) {
	// strings.Map would also replace invalid UTF-8 with U+FFFD,
	// so it runs only when there is something to remove.
	if !strings.ContainsFunc(s, isDefaultIgnorable) {
		return s, false
	}
	return strings.Map(func(r rune) rune {
		if isDefaultIgnorable(r) {
			return -1
		}
		return r
	}, s), true
}

func isDefaultIgnorable(r rune) bool {
	return unicode.Is(defaultIgnorable, r)
}

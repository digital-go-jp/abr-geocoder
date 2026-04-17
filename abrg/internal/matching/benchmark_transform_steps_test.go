package matching

import (
	"abrg/internal/normalize"
	"abrg/internal/transform"
	"abrg/internal/util"
	"testing"
)

// Benchmark individual transformation functions
func BenchmarkTransformSteps(b *testing.B) {
	input := "東京都千代田区紀尾井町１番３号"

	b.Run("nfkc", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_, _ = normalize.NFKCNormalize(input)
		}
	})

	b.Run("kanji_to_arabic", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_, _ = transform.KanjiToArabic(input)
		}
	})

	b.Run("normalize_dashes", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_, _ = normalize.NormalizeDashes(input)
		}
	})

	b.Run("remove_oaza_aza", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_, _ = util.RemoveOazaAza(input)
		}
	})

	b.Run("chome_to_symbol", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_ = transform.ChomeToSymbol(input)
		}
	})

	b.Run("address_numbers_to_hyphen", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_, _ = normalize.AddressNumbersToHyphen(input)
		}
	})

	b.Run("standardize_special_chars", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_, _ = transform.StandardizeSpecialChars(input)
		}
	})

	b.Run("add_colon", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_, _ = transform.AddColon(input)
		}
	})

	b.Run("standardize_spaces", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			_, _ = normalize.NormalizeSpaces(input)
		}
	})
}

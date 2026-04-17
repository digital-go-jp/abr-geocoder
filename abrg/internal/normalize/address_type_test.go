package normalize

import (
	"testing"

	"abrg/internal/model"
)

func TestDetectAddressType(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected model.NormalizeCategory
	}{
		// Residential address patterns (rsdtdsp)
		{
			name:     "ban pattern without go",
			address:  "1番2",
			expected: model.NormalizeCategoryUndetermined,
		},
		{
			name:     "ban only pattern",
			address:  "1310番",
			expected: model.NormalizeCategoryUndetermined,
		},
		{
			name:     "ban only pattern with address",
			address:  "埼玉県川崎市幸区大宮町1310番",
			expected: model.NormalizeCategoryUndetermined,
		},
		{
			name:     "basic ban-go pattern",
			address:  "1番2号",
			expected: model.NormalizeCategoryResidential,
		},
		{
			name:     "ban-go with hyphenated address",
			address:  "1番2-345号",
			expected: model.NormalizeCategoryResidential,
		},
		{
			name:     "ban-go with multiple hyphens",
			address:  "1番2-3-4号",
			expected: model.NormalizeCategoryResidential,
		},
		{
			name:     "ban-go with many hyphens",
			address:  "1番2-3-4-5-6号",
			expected: model.NormalizeCategoryResidential,
		},
		{
			name:     "ban-go with alphanumeric suffix",
			address:  "22番5-A1002号",
			expected: model.NormalizeCategoryResidential,
		},
		{
			name:     "ban-go with full address",
			address:  "東京都千代田区紀尾井町1番3号",
			expected: model.NormalizeCategoryResidential,
		},
		{
			name:     "ban-go with half-width space",
			address:  "千代田区 1番2号",
			expected: model.NormalizeCategoryUnknown, // Space splits the address, so first part has no number pattern
		},
		{
			name:     "three digit ban-go",
			address:  "123番456号",
			expected: model.NormalizeCategoryResidential,
		},

		// Parcel address patterns
		{
			name:     "basic banchi pattern",
			address:  "1番地",
			expected: model.NormalizeCategoryParcel,
		},
		{
			name:     "banchi with number",
			address:  "1番地2",
			expected: model.NormalizeCategoryParcel,
		},
		{
			name:     "banchi no pattern",
			address:  "1番地の2",
			expected: model.NormalizeCategoryParcel,
		},
		{
			name:     "banchi with full address",
			address:  "東京都世田谷区1番地",
			expected: model.NormalizeCategoryParcel,
		},
		{
			name:     "banchi no with full address",
			address:  "東京都世田谷区1番地の2",
			expected: model.NormalizeCategoryParcel,
		},
		{
			name:     "banchi number with full address",
			address:  "東京都世田谷区1番地3",
			expected: model.NormalizeCategoryParcel,
		},
		{
			name:     "large banchi numbers",
			address:  "123番地456",
			expected: model.NormalizeCategoryParcel,
		},
		{
			name:     "Okayama Niimi banchi with space",
			address:  "岡山県新見市神郷下神代 2029番地",
			expected: model.NormalizeCategoryUnknown, // Space splits the address, so first part has no number pattern
		},

		// Undetermined patterns (arabicDashPattern - cannot determine if residential or parcel)
		{
			name:     "arabic dash pattern",
			address:  "1-2-3",
			expected: model.NormalizeCategoryUndetermined,
		},
		{
			name:     "arabic dash with prefecture",
			address:  "東京都千代田区1-2-3",
			expected: model.NormalizeCategoryUndetermined,
		},
		{
			name:     "incorrect format banchi-go",
			address:  "1番地2号",
			expected: model.NormalizeCategoryUndetermined,
		},
		{
			name:     "incorrect format banchi-go with address",
			address:  "東京都千代田区1番地2号",
			expected: model.NormalizeCategoryUndetermined,
		},
		{
			name:     "incorrect format banchi with hyphenated go",
			address:  "8番地20-101号",
			expected: model.NormalizeCategoryUndetermined,
		},
		{
			name:     "incorrect format banchi with hyphenated go and address",
			address:  "東京都千代田区神田多町二丁目8番地20-101号",
			expected: model.NormalizeCategoryUndetermined,
		},

		// Unknown patterns
		{
			name:     "prefecture only",
			address:  "東京都",
			expected: model.NormalizeCategoryUnknown,
		},
		{
			name:     "city only",
			address:  "千代田区",
			expected: model.NormalizeCategoryUnknown,
		},
		{
			name:     "empty string",
			address:  "",
			expected: model.NormalizeCategoryUnknown,
		},
		{
			name:     "only chome",
			address:  "1丁目",
			expected: model.NormalizeCategoryUnknown,
		},
		{
			name:     "mixed patterns without clear indicators",
			address:  "東京都千代田区丸の内",
			expected: model.NormalizeCategoryUnknown,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := detectAddressType(tt.address)
			if result != tt.expected {
				t.Errorf("detectAddressType(%q) = %q, want %q", tt.address, result, tt.expected)
			}
		})
	}
}

func BenchmarkDetectAddressType(b *testing.B) {
	testCases := []string{
		"1番2号",
		"東京都千代田区紀尾井町1番3号",
		"1番地",
		"1番地の2",
		"東京都世田谷区1番地",
		"東京都",
		"1-2-3",
	}

	for b.Loop() {
		for _, address := range testCases {
			detectAddressType(address)
		}
	}
}

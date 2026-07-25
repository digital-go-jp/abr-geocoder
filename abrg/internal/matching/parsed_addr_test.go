package matching

import (
	"slices"
	"testing"
)

func TestParseSearchAddr(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected parsedAddress
	}{
		{
			name:  "standard format with numbers",
			input: "港区虎ノ門:1-23-1",
			expected: parsedAddress{
				Base:    "港区虎ノ門",
				Numbers: []string{"1", "23", "1"},
			},
		},
		{
			name:  "with chome marker",
			input: "港区虎ノ門1@:6-5",
			expected: parsedAddress{
				Base:     "港区虎ノ門",
				Chome:    "1",
				HasChome: true,
				Numbers:  []string{"6", "5"},
			},
		},
		{
			name:  "with building name",
			input: "神田佐久間町2@:1 永島ビル9階",
			expected: parsedAddress{
				Base:     "神田佐久間町",
				Chome:    "2",
				HasChome: true,
				Numbers:  []string{"1"},
				Building: "永島ビル9階",
			},
		},
		{
			name:  "no numbers",
			input: "港区虎ノ門",
			expected: parsedAddress{
				Base: "港区虎ノ門",
			},
		},
		{
			name:  "chome only no numbers",
			input: "浦安市舞浜2@",
			expected: parsedAddress{
				Base:     "浦安市舞浜",
				Chome:    "2",
				HasChome: true,
			},
		},
		{
			name:  "kanji block number",
			input: "久太郎町4@:渡辺-3",
			expected: parsedAddress{
				Base:     "久太郎町",
				Chome:    "4",
				HasChome: true,
				Numbers:  []string{"渡辺", "3"},
			},
		},
		{
			name:  "sapporo abbreviated pattern with leading hyphen",
			input: "北3条西1@:-7",
			expected: parsedAddress{
				Base:          "北3条西",
				Chome:         "1",
				HasChome:      true,
				Numbers:       []string{"7"},
				LeadingHyphen: true,
			},
		},
		{
			name:     "empty string",
			input:    "",
			expected: parsedAddress{},
		},
		{
			name:  "colon with empty after",
			input: "港区虎ノ門:",
			expected: parsedAddress{
				Base: "港区虎ノ門",
			},
		},
		{
			name:  "single number after colon",
			input: "千代田区:5",
			expected: parsedAddress{
				Base:    "千代田区",
				Numbers: []string{"5"},
			},
		},
		{
			name:  "chome conversion format",
			input: "浦安市舞浜2@:11",
			expected: parsedAddress{
				Base:     "浦安市舞浜",
				Chome:    "2",
				HasChome: true,
				Numbers:  []string{"11"},
			},
		},
		{
			name:  "building name after numbers",
			input: "港区虎ノ門:1-23-1 タワーレジデンス",
			expected: parsedAddress{
				Base:     "港区虎ノ門",
				Numbers:  []string{"1", "23", "1"},
				Building: "タワーレジデンス",
			},
		},
		{
			name:  "oaza with chome-like name and text after @ (壱丁目南)",
			input: "上尾市1@南:15-15",
			expected: parsedAddress{
				Base:       "上尾市",
				Chome:      "1",
				HasChome:   true,
				AfterChome: "南",
				Numbers:    []string{"15", "15"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseSearchAddr(tt.input)
			if got.Base != tt.expected.Base {
				t.Errorf("Base = %q, want %q", got.Base, tt.expected.Base)
			}
			if got.Chome != tt.expected.Chome {
				t.Errorf("Chome = %q, want %q", got.Chome, tt.expected.Chome)
			}
			if got.HasChome != tt.expected.HasChome {
				t.Errorf("HasChome = %v, want %v", got.HasChome, tt.expected.HasChome)
			}
			if got.AfterChome != tt.expected.AfterChome {
				t.Errorf("AfterChome = %q, want %q", got.AfterChome, tt.expected.AfterChome)
			}
			if !slices.Equal(got.Numbers, tt.expected.Numbers) {
				t.Errorf("Numbers = %v, want %v", got.Numbers, tt.expected.Numbers)
			}
			if got.LeadingHyphen != tt.expected.LeadingHyphen {
				t.Errorf("LeadingHyphen = %v, want %v", got.LeadingHyphen, tt.expected.LeadingHyphen)
			}
			if got.Building != tt.expected.Building {
				t.Errorf("Building = %q, want %q", got.Building, tt.expected.Building)
			}
		})
	}
}

func TestParsedAddressString(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"standard format", "港区虎ノ門:1-23-1", "港区虎ノ門:1-23-1"},
		{"with chome", "港区虎ノ門1@:6-5", "港区虎ノ門1@:6-5"},
		{"with building", "神田佐久間町2@:1 永島ビル9階", "神田佐久間町2@:1 永島ビル9階"},
		{"no numbers", "港区虎ノ門", "港区虎ノ門"},
		{"chome only", "浦安市舞浜2@", "浦安市舞浜2@"},
		{"empty string", "", ""},
		{"colon empty after", "港区虎ノ門:", "港区虎ノ門"},
		{"single number", "千代田区:5", "千代田区:5"},
		{"sapporo pattern", "北3条西1@:-7", "北3条西1@:-7"},
		{"oaza after chome marker", "上尾市1@南:15-15", "上尾市1@南:15-15"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := parseSearchAddr(tt.input)
			got := parsed.String()
			if got != tt.expected {
				t.Errorf("parseSearchAddr(%q).String() = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestParsedAddress_Numbers(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{"standard format", "港区虎ノ門:1-23-1", []string{"1", "23", "1"}},
		{"with building name", "神田佐久間町2@:1 永島ビル9階", []string{"1"}},
		{"two numbers", "港区虎ノ門1@:6-5", []string{"6", "5"}},
		{"kanji block", "久太郎町4@:渡辺-3", []string{"渡辺", "3"}},
		{"no colon", "港区虎ノ門1-23-1", nil},
		{"empty after colon", "港区虎ノ門:", nil},
		{"empty string", "", nil},
		{"single number", "千代田区:5", []string{"5"}},
		{"oaza after chome marker", "上尾市1@南:15-15", []string{"15", "15"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := parseSearchAddr(tt.input)
			result := parsed.Numbers
			if !slices.Equal(result, tt.expected) {
				t.Errorf("parseSearchAddr(%q).Numbers = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestParsedAddress_numericParts(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{"all numeric", "港区虎ノ門1@:6-5", []string{"6", "5"}},
		{"with building name", "神田佐久間町2@:1 永島ビル9階", []string{"1"}},
		{"kanji excluded", "久太郎町4@:渡辺-3", nil},
		{"stops at non-numeric", "test:1-2-abc-3", []string{"1", "2"}},
		{"number with trailing chars", "test:123abc-456", []string{"123", "456"}},
		{"no colon", "港区虎ノ門", nil},
		{"empty after colon", "test:", nil},
		{"three numbers", "test:1-2-3", []string{"1", "2", "3"}},
		{"oaza after chome marker", "上尾市1@南:15-15", []string{"15", "15"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := parseSearchAddr(tt.input)
			result := parsed.numericParts()
			if !slices.Equal(result, tt.expected) {
				t.Errorf("parseSearchAddr(%q).numericParts() = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestParsedAddressExtractChome(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"with chome", "港区虎ノ門1@:6", "1"},
		{"chome two digits", "浦安市舞浜2@:11", "2"},
		{"no chome", "港区虎ノ門:1-23-1", ""},
		{"empty", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed := parseSearchAddr(tt.input)
			if parsed.Chome != tt.expected {
				t.Errorf("parseSearchAddr(%q).Chome = %q, want %q", tt.input, parsed.Chome, tt.expected)
			}
		})
	}
}

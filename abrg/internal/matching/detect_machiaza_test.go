package matching

import (
	"testing"
)

func TestHasKoazaSuffix(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{"gaiku suffix", "街区1-2", true},
		{"chiwari suffix", "地割123", true},
		{"bunka suffix", "分区北", true},
		{"bangawa suffix", "番川町", true},
		{"bandori suffix", "番通り", true},
		{"no suffix - town", "町1-2", false},
		{"empty string", "", false},
		{"numbers only", "123", false},
		{"chome suffix", "丁目", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := hasKoazaSuffix(tt.input); got != tt.want {
				t.Errorf("hasKoazaSuffix(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

// TestExtractFirstNumberWithHyphen tests the extractFirstNumberWithHyphen function
// Returns: baseAddress, afterBase, hasHyphen, isTrailingHyphen
func TestExtractFirstNumberWithHyphen(t *testing.T) {
	tests := []struct {
		name               string
		input              string
		wantBase           string
		wantAfter          string
		wantHasHyphen      bool
		wantTrailingHyphen bool
	}{
		{
			name:               "Simple hyphenated number",
			input:              "町名1-2-3",
			wantBase:           "町名",
			wantAfter:          "1-2-3",
			wantHasHyphen:      true,
			wantTrailingHyphen: false,
		},
		{
			name:               "Multi-digit first number",
			input:              "町名123-456-789",
			wantBase:           "町名",
			wantAfter:          "123-456-789",
			wantHasHyphen:      true,
			wantTrailingHyphen: false,
		},
		{
			name:               "Single number no hyphen",
			input:              "町名123",
			wantBase:           "",
			wantAfter:          "",
			wantHasHyphen:      false,
			wantTrailingHyphen: false,
		},
		{
			name:               "Empty string",
			input:              "",
			wantBase:           "",
			wantAfter:          "",
			wantHasHyphen:      false,
			wantTrailingHyphen: false,
		},
		{
			name:               "Non-numeric input",
			input:              "東京都千代田区",
			wantBase:           "",
			wantAfter:          "",
			wantHasHyphen:      false,
			wantTrailingHyphen: false,
		},
		{
			name:               "Trailing hyphen",
			input:              "町名1-",
			wantBase:           "町名",
			wantAfter:          "1",
			wantHasHyphen:      true,
			wantTrailingHyphen: true,
		},
		{
			name:               "Complex address with numbers",
			input:              "永田町5-18-5-802",
			wantBase:           "永田町",
			wantAfter:          "5-18-5-802",
			wantHasHyphen:      true,
			wantTrailingHyphen: false,
		},
		{
			name:               "Koaza suffix - 街区",
			input:              "町名11-2街区",
			wantBase:           "",
			wantAfter:          "",
			wantHasHyphen:      false,
			wantTrailingHyphen: false,
		},
		{
			name:               "Koaza suffix - 地割",
			input:              "町名5-3地割",
			wantBase:           "",
			wantAfter:          "",
			wantHasHyphen:      false,
			wantTrailingHyphen: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotBase, gotAfter, gotHasHyphen, gotTrailingHyphen := extractFirstNumberWithHyphen(tt.input)
			if gotBase != tt.wantBase {
				t.Errorf("extractFirstNumberWithHyphen(%q) base = %q, want %q", tt.input, gotBase, tt.wantBase)
			}
			if gotAfter != tt.wantAfter {
				t.Errorf("extractFirstNumberWithHyphen(%q) after = %q, want %q", tt.input, gotAfter, tt.wantAfter)
			}
			if gotHasHyphen != tt.wantHasHyphen {
				t.Errorf("extractFirstNumberWithHyphen(%q) hasHyphen = %v, want %v", tt.input, gotHasHyphen, tt.wantHasHyphen)
			}
			if gotTrailingHyphen != tt.wantTrailingHyphen {
				t.Errorf("extractFirstNumberWithHyphen(%q) trailingHyphen = %v, want %v", tt.input, gotTrailingHyphen, tt.wantTrailingHyphen)
			}
		})
	}
}

func TestBuildFallbackAddress(t *testing.T) {
	tests := []struct {
		name              string
		baseAddress       string
		afterColon        string
		expectedFallback  string
		expectedRemaining string
	}{
		{
			name:              "With colon and single digit",
			baseAddress:       "千代田区神田佐久間町",
			afterColon:        "1-3",
			expectedFallback:  "千代田区神田佐久間町1@",
			expectedRemaining: ":3",
		},
		{
			// 123丁目 and 0丁目 exist nowhere: ABR tops out at 42丁目. These
			// three pin how the digits are split, not a real address.
			name:              "With colon and multi-digit",
			baseAddress:       "千代田区神田佐久間町",
			afterColon:        "123-456",
			expectedFallback:  "千代田区神田佐久間町123@",
			expectedRemaining: ":456",
		},
		{
			name:              "No number after colon",
			baseAddress:       "千代田区神田佐久間町",
			afterColon:        "",
			expectedFallback:  "",
			expectedRemaining: "",
		},
		{
			name:              "Japanese text after colon",
			baseAddress:       "千代田区神田佐久間町",
			afterColon:        "文字列",
			expectedFallback:  "",
			expectedRemaining: "",
		},
		{
			name:              "Space before number",
			baseAddress:       "千代田区神田佐久間町",
			afterColon:        " 1-3",
			expectedFallback:  "",
			expectedRemaining: "",
		},
		{
			name:              "Complex address with number",
			baseAddress:       "大阪市中央区難波",
			afterColon:        "3-5-7",
			expectedFallback:  "大阪市中央区難波3@",
			expectedRemaining: ":5-7",
		},
		{
			name:              "Kanda Kajicho example",
			baseAddress:       "千代田区神田鍛冶町",
			afterColon:        "3-1-2",
			expectedFallback:  "千代田区神田鍛冶町3@",
			expectedRemaining: ":1-2",
		},
		{
			name:              "Zero",
			baseAddress:       "千代田区神田佐久間町",
			afterColon:        "0-1",
			expectedFallback:  "千代田区神田佐久間町0@",
			expectedRemaining: ":1",
		},
		{
			name:              "Number without hyphen",
			baseAddress:       "千代田区神田佐久間町",
			afterColon:        "123",
			expectedFallback:  "千代田区神田佐久間町123@",
			expectedRemaining: "",
		},
		{
			name:              "Kajicho example",
			baseAddress:       "千代田区鍛冶町",
			afterColon:        "1-1",
			expectedFallback:  "千代田区鍛冶町1@",
			expectedRemaining: ":1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fallback, remaining := buildFallbackAddress(tt.baseAddress, tt.afterColon)
			if fallback != tt.expectedFallback {
				t.Errorf("buildFallbackAddress(%q, %q) fallback = %q, want %q",
					tt.baseAddress, tt.afterColon, fallback, tt.expectedFallback)
			}
			if remaining != tt.expectedRemaining {
				t.Errorf("buildFallbackAddress(%q, %q) remaining = %q, want %q",
					tt.baseAddress, tt.afterColon, remaining, tt.expectedRemaining)
			}
		})
	}
}

package normalize

import (
	"testing"
)

func TestAddSpacesAroundPunctuation(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		// Parentheses tests
		{
			name:     "parentheses with text",
			input:    "東京都港区(六本木)",
			expected: "東京都港区 (六本木)",
			changed:  true,
		},
		{
			name:     "already spaced parentheses",
			input:    "東京都港区 (六本木) ",
			expected: "東京都港区 (六本木)",
			changed:  true,
		},
		{
			name:     "nested parentheses",
			input:    "東京都(港区(六本木))",
			expected: "東京都 (港区 (六本木) )",
			changed:  true,
		},
		// Comma tests
		{
			name:     "comma in address",
			input:    "東京都港区,六本木",
			expected: "東京都港区 ,六本木",
			changed:  true,
		},
		{
			name:     "multiple commas",
			input:    "東京都,港区,六本木",
			expected: "東京都 ,港区 ,六本木",
			changed:  true,
		},
		// Japanese comma (読点) tests
		{
			name:     "Japanese comma in address",
			input:    "東京都港区、六本木",
			expected: "東京都港区 、六本木",
			changed:  true,
		},
		{
			name:     "multiple Japanese commas",
			input:    "東京都、港区、六本木",
			expected: "東京都 、港区 、六本木",
			changed:  true,
		},
		// Mixed punctuation tests
		{
			name:     "parentheses and comma",
			input:    "東京都港区(六本木,1-2-3)",
			expected: "東京都港区 (六本木 ,1-2-3)",
			changed:  true,
		},
		{
			name:     "parentheses and Japanese comma",
			input:    "東京都港区(六本木、1-2-3)",
			expected: "東京都港区 (六本木 、1-2-3)",
			changed:  true,
		},
		{
			name:     "all punctuation types",
			input:    "東京都(港区、六本木),1-2-3",
			expected: "東京都 (港区 、六本木) ,1-2-3",
			changed:  true,
		},
		// No change tests
		{
			name:     "no punctuation",
			input:    "東京都港区六本木1-2-3",
			expected: "東京都港区六本木1-2-3",
			changed:  false,
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
			changed:  false,
		},
		// Real-world examples
		{
			name:     "address with building name in parentheses",
			input:    "神戸市東灘区向洋町中1-14(イーストコート2番街)",
			expected: "神戸市東灘区向洋町中1-14 (イーストコート2番街)",
			changed:  true,
		},
		{
			name:     "complex address with comma",
			input:    "東京都千代田区丸の内1-9-1,東京駅",
			expected: "東京都千代田区丸の内1-9-1 ,東京駅",
			changed:  true,
		},
		// Consecutive spaces handling
		{
			name:     "input with consecutive spaces",
			input:    "東京都  港区(六本木)",
			expected: "東京都 港区 (六本木)",
			changed:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, changed := addSpacesAroundPunctuation(tt.input)
			if result != tt.expected {
				t.Errorf("addSpacesAroundPunctuation(%q) = %q, want %q", tt.input, result, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("addSpacesAroundPunctuation(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

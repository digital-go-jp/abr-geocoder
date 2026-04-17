package transform

import "testing"

func TestExpandSapporoJou(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		changed  bool
	}{
		{
			name:     "basic abbreviation - 北3西1",
			input:    "札幌市中央区北3西1-7",
			expected: "札幌市中央区北3条西1丁目-7",
			changed:  true,
		},
		{
			name:     "南東 pattern",
			input:    "札幌市東区南10東5-3",
			expected: "札幌市東区南10条東5丁目-3",
			changed:  true,
		},
		{
			name:     "already has 条 - no change",
			input:    "札幌市中央区北3条西1丁目7",
			expected: "札幌市中央区北3条西1丁目7",
			changed:  false,
		},
		{
			name:     "not sapporo pattern - no change",
			input:    "東京都新宿区西新宿2-8-1",
			expected: "東京都新宿区西新宿2-8-1",
			changed:  false,
		},
		{
			name:     "partial match only - 北 without pattern",
			input:    "札幌市北区北24条西6丁目",
			expected: "札幌市北区北24条西6丁目",
			changed:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, changed := ExpandSapporoJou(tt.input)
			if got != tt.expected {
				t.Errorf("ExpandSapporoJou(%q) = %q, want %q", tt.input, got, tt.expected)
			}
			if changed != tt.changed {
				t.Errorf("ExpandSapporoJou(%q) changed = %v, want %v", tt.input, changed, tt.changed)
			}
		})
	}
}

package normalize

import "testing"

func TestBasicNormalize(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "no change needed",
			input: "東京都千代田区",
			want:  "東京都千代田区",
		},
		{
			name:  "removes surrounding quotes",
			input: `"東京都千代田区"`,
			want:  "東京都千代田区",
		},
		{
			name:  "removes variation selectors",
			input: "愛媛\U000E0103県", // 愛媛 + variation selector + 県
			want:  "愛媛県",
		},
		{
			name:  "standardizes spaces",
			input: "東京都　千代田区",
			want:  "東京都 千代田区",
		},
		{
			name:  "removes newlines",
			input: "東京都\n千代田区",
			want:  "東京都 千代田区",
		},
		{
			name:  "removes comments",
			input: "東京都千代田区// コメント", // No space before comment
			want:  "東京都千代田区",
		},
		{
			name:  "NFKC normalization - full-width to half-width",
			input: "１２３",
			want:  "123",
		},
		{
			name:  "normalizes dashes",
			input: "東京都千代田区1—2", // em-dash
			want:  "東京都千代田区1-2",
		},
		{
			name:  "combined transformations - quotes",
			input: `"東京都　１−２"`, // quotes, full-width space, full-width numbers, en-dash
			want:  "東京都 1-2",
		},
		{
			name:  "combined transformations - comment",
			input: `東京都　１−２// test`, // full-width space, full-width numbers, en-dash, comment
			want:  "東京都 1-2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := BasicNormalize(tt.input)
			if result != tt.want {
				t.Errorf("BasicNormalize() = %q, want %q", result, tt.want)
			}
		})
	}
}

func TestBasicNormalize_Pipeline(t *testing.T) {
	// Test that BasicNormalize applies all transformations in the correct order
	// This is important because some transformations depend on others

	// Input with multiple issues that need to be fixed in a specific order
	input := `"　東京都１−２　"` // quotes, full-width spaces, full-width number, en-dash

	result := BasicNormalize(input)

	// After all transformations:
	// 1. removeQuotes: 　東京都１−２
	// 2. removeVS: (no change)
	// 3. NormalizeSpaces: 東京都１−２ (trims and normalizes spaces)
	// 4. removeComments: (no change)
	// 5. NFKCNormalize: 東京都1−2 (full-width to half-width)
	// 6. NormalizeDashes: 東京都1-2 (en-dash to hyphen-minus)
	want := "東京都1-2"

	if result != want {
		t.Errorf("BasicNormalize() = %q, want %q", result, want)
	}
}

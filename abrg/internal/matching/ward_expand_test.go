package matching

import "testing"

func TestExtractWardPrefix(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"standard ward", "中区本町", "中区"},
		{"compound ward", "中央区銀座", "中央区"},
		{"no ward", "本町1-1", ""},
		{"empty", "", ""},
		{"ward only", "中区", "中区"},
		{"ward at start with numbers", "南区白妙町1-1", "南区"},
		// When city+ward is present, extractWardPrefix finds the first 区.
		// This is fine because the wardCandidates lookup won't match a city+ward key.
		{"city+ward returns up to first ku", "京都市下京区河原町", "京都市下京区"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := extractWardPrefix(tt.input)
			if got != tt.want {
				t.Errorf("extractWardPrefix(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

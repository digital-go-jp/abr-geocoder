package levenshtein

import "testing"

func TestRuneLevenshtein(t *testing.T) {
	tests := []struct {
		name string
		a, b string
		want int
	}{
		{"empty strings", "", "", 0},
		{"one empty", "abc", "", 3},
		{"other empty", "", "abc", 3},
		{"identical ASCII", "hello", "hello", 0},
		{"single ASCII diff", "hello", "hallo", 1},
		{"identical kanji", "福山市", "福山市", 0},
		{"single kanji diff", "港町", "旭町", 1},
		{"kanji prefix match", "福山市港町", "福山市旭町", 1},
		{"completely different kanji", "東京都", "大阪府", 3},
		{"mixed kanji/kana", "港区", "湊区", 1},
		{"length difference", "福山市", "福山市旭町", 2},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := runeLevenshtein(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("runeLevenshtein(%q, %q) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

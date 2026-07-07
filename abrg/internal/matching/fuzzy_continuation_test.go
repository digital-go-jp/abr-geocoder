package matching

import (
	"testing"

	"abrg/internal/model"
)

func TestIsPureSubstitution(t *testing.T) {
	tests := []struct {
		name string
		a, b string
		want bool
	}{
		{"identical", "紀尾井町", "紀尾井町", true},
		{"single substitution gaiji", "紀●井町", "紀尾井町", true},
		{"single substitution kanji", "紀緒井町", "紀尾井町", true},
		{"two substitutions exceed max", "紀●○町", "紀尾井町", false},
		{"insertion changes length", "福室字久保野", "福室字久保野二番", false},
		{"deletion changes length", "八条寺内町", "八条寺ノ内町", false},
		{"empty input", "", "紀尾井町", false},
		{"both empty", "", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isPureSubstitution(tt.a, tt.b); got != tt.want {
				t.Errorf("isPureSubstitution(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

func TestCapScoresToFuzzy(t *testing.T) {
	results := []model.MatchedResult{{Score: 1.0}, {Score: 0.5}, {Score: 0.67}}
	capScoresToFuzzy(results, 0.67)
	want := []float64{0.67, 0.5, 0.67}
	for i, r := range results {
		if r.Score != want[i] {
			t.Errorf("results[%d].Score = %v, want %v", i, r.Score, want[i])
		}
	}
}

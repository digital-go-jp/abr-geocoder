package levenshtein

import "testing"

func TestCalculateEditDistanceScore(t *testing.T) {
	tests := []struct {
		name       string
		editDist   int
		addressLen int
		want       float64
	}{
		{
			name:       "perfect match",
			editDist:   0,
			addressLen: 10,
			want:       1.0,
		},
		{
			name:       "empty address",
			editDist:   0,
			addressLen: 0,
			want:       1.0,
		},
		{
			name:       "half match",
			editDist:   5,
			addressLen: 10,
			want:       0.5,
		},
		{
			name:       "poor match",
			editDist:   8,
			addressLen: 10,
			want:       0.2,
		},
		{
			name:       "no match",
			editDist:   10,
			addressLen: 10,
			want:       0.0,
		},
		{
			name:       "edit distance exceeds length",
			editDist:   15,
			addressLen: 10,
			want:       0.0,
		},
		{
			// score 0.999 rounds up to 1.0, so it is capped at maxFuzzyMatchScore
			// to keep fuzzy matches strictly below a perfect (editDist=0) score.
			name:       "near-perfect fuzzy match capped below 1.0",
			editDist:   1,
			addressLen: 1000,
			want:       0.999,
		},
		{
			name:       "rounds to two decimals",
			editDist:   1,
			addressLen: 3,
			want:       0.67,
		},
		{
			name:       "single edit in long address rounds to 0.99",
			editDist:   1,
			addressLen: 100,
			want:       0.99,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := calculateEditDistanceScore(tt.editDist, tt.addressLen)
			if got != tt.want {
				t.Errorf("calculateEditDistanceScore(%d, %d) = %v, want %v", tt.editDist, tt.addressLen, got, tt.want)
			}
		})
	}
}

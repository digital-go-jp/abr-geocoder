package matching

import (
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

func TestCompareResultStrength(t *testing.T) {
	result := func(score float64, level model.MatchLevel) model.MatchedResult {
		return model.MatchedResult{Score: score, MatchLevel: level}
	}
	tests := []struct {
		name string
		a, b model.MatchedResult
		want int
	}{
		{"higher score first", result(0.75, model.MatchLevelMachiaza), result(0.63, model.MatchLevelParcel), -1},
		{"lower score last", result(0.63, model.MatchLevelParcel), result(0.75, model.MatchLevelMachiaza), 1},
		{"deeper level breaks a tie", result(1, model.MatchLevelParcel), result(1, model.MatchLevelMachiaza), -1},
		{"scores within epsilon tie", result(1, model.MatchLevelMachiaza), result(0.999, model.MatchLevelParcel), 1},
		{"equal", result(1, model.MatchLevelCity), result(1, model.MatchLevelCity), 0},
	}
	for _, tt := range tests {
		if got := compareResultStrength(tt.a, tt.b); got != tt.want {
			t.Errorf("%s: compareResultStrength = %d, want %d", tt.name, got, tt.want)
		}
	}
}

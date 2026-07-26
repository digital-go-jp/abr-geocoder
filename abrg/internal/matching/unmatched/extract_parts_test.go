package unmatched

import (
	"slices"
	"testing"

	"abrg/internal/model"
)

func TestExtractUnmatchedParts(t *testing.T) {
	tests := []struct {
		name           string
		normalizedAddr string
		matchedAddr    string
		searchAddr     string
		want           []string
	}{
		{
			name:           "Prefecture level match with building name",
			normalizedAddr: "東京都中央区八丁ののののの堀四丁目12-7 サニービル4階D号",
			matchedAddr:    "東京都中央区八丁堀4丁目",
			searchAddr:     "中央区8丁ノノノノノ堀4@:12-7",
			want:           []string{"12-7", "サニービル4階D号"},
		},
		{
			name:           "Chome matched - remove first number (虎ノ門 case)",
			normalizedAddr: "東京都港区虎ノ門1-23-1 虎ノ門ヒルズ森タワー 22階",
			matchedAddr:    "東京都港区虎ノ門1丁目",
			searchAddr:     "港区虎ノ門:23-1", // After adjustSearchAddrForChomeMatch
			want:           []string{"23-1", "虎ノ門ヒルズ森タワー", "22階"},
		},
		{
			name:           "Unmatched with building name - preserve hiragana and kanji",
			normalizedAddr: "文京区千駄木五丁目9-1",
			matchedAddr:    "文京区千駄木5丁目",
			searchAddr:     "文京区千駄木5@:9-1",
			want:           []string{"9-1"},
		},
		{
			name:           "No building name",
			normalizedAddr: "中央区八丁堀四丁目12-7",
			matchedAddr:    "中央区八丁堀4丁目",
			searchAddr:     "中央区8丁堀4@:12-7",
			want:           []string{"12-7"},
		},
		{
			name:           "Multiple building parts",
			normalizedAddr: "渋谷区神宮前一丁目1-1 表参道ビル 3階 301号室",
			matchedAddr:    "渋谷区神宮前1丁目",
			searchAddr:     "渋谷区神宮前1@:1-1",
			want:           []string{"1-1", "表参道ビル", "3階", "301号室"},
		},
		{
			name:           "Empty searchAddr - no numbers to extract",
			normalizedAddr: "東京都渋谷区神宮前 ビルA",
			matchedAddr:    "東京都渋谷区神宮前",
			searchAddr:     "",
			want:           []string{"ビルA"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractUnmatchedParts(tt.normalizedAddr, tt.matchedAddr, tt.searchAddr)
			if !slices.Equal(got, tt.want) {
				t.Errorf("ExtractUnmatchedParts() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestCreateUnmatchedResult tests the CreateUnmatchedResult function
func TestCreateUnmatchedResult(t *testing.T) {
	tests := []struct {
		name           string
		originalAddr   string
		wantMatchLevel model.MatchLevel
		wantScore      float64
	}{
		{
			name:           "basic unmatched result",
			originalAddr:   "東京都千代田区",
			wantMatchLevel: model.MatchLevelUnknown,
			wantScore:      -1,
		},
		{
			name:           "with space separated parts",
			originalAddr:   "東京都 千代田区 永田町",
			wantMatchLevel: model.MatchLevelUnknown,
			wantScore:      -1,
		},
		{
			name:           "empty original",
			originalAddr:   "",
			wantMatchLevel: model.MatchLevelUnknown,
			wantScore:      -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CreateUnmatchedResult(tt.originalAddr)

			if got.MatchLevel != tt.wantMatchLevel {
				t.Errorf("CreateUnmatchedResult() MatchLevel = %v, want %v", got.MatchLevel, tt.wantMatchLevel)
			}

			if got.Score != tt.wantScore {
				t.Errorf("CreateUnmatchedResult() Score = %v, want %v", got.Score, tt.wantScore)
			}

			if got.MatchedAddress != "" {
				t.Errorf("CreateUnmatchedResult() MatchedAddress = %q, want empty", got.MatchedAddress)
			}
		})
	}
}

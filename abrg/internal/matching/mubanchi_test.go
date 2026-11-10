package matching

import (
	"slices"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// 無番地 states that the place has no lot number, but some machiaza carry it
// in their name, so it is dropped only when the whole address finds nothing.
func TestMatchMubanchiSuffix(t *testing.T) {
	n := setupTestMatcher(t)

	tests := []struct {
		name          string
		addr          string
		wantLevel     model.MatchLevel
		wantLgCode    string
		wantMachiaza  string
		wantUnmatched []string
	}{
		{
			name:          "koaza followed by 無番地",
			addr:          "東京都大島町差木地字クダッチ無番地",
			wantLevel:     model.MatchLevelMachiazaDetail,
			wantLgCode:    "133612",
			wantMachiaza:  "0007114",
			wantUnmatched: []string{"無番地"},
		},
		{
			name:          "city followed by 無番地",
			addr:          "東京都御蔵島村無番地",
			wantLevel:     model.MatchLevelMachiaza,
			wantLgCode:    "133825",
			wantMachiaza:  "0000000",
			wantUnmatched: []string{"無番地"},
		},
		{
			name:         "machiaza named 無番地",
			addr:         "東京都青ヶ島村無番地",
			wantLevel:    model.MatchLevelMachiaza,
			wantLgCode:   "134023",
			wantMachiaza: "0005000",
		},
		{
			name:         "koaza named 無番地",
			addr:         "愛知県海部郡飛島村大字政成新田無番地",
			wantLevel:    model.MatchLevelMachiazaDetail,
			wantLgCode:   "234273",
			wantMachiaza: "0019115",
		},
	}

	for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
		for _, tt := range tests {
			t.Run(string(category)+"/"+tt.name, func(t *testing.T) {
				resp, err := n.Match(t.Context(), model.MatchQuery{Address: tt.addr, Category: category, Pref: model.All, Limit: 1})
				if err != nil {
					t.Fatalf("Match(%q) error: %v", tt.addr, err)
				}
				if len(resp.Features) == 0 {
					t.Fatalf("Match(%q) returned no results", tt.addr)
				}
				got := resp.Features[0]
				if got.MatchLevel != tt.wantLevel {
					t.Errorf("match_level = %s, want %s", got.MatchLevel, tt.wantLevel)
				}
				if lg, mz := derefString(got.IDs.LgCode), derefString(got.IDs.MachiazaID); lg != tt.wantLgCode || mz != tt.wantMachiaza {
					t.Errorf("lg_code=%s machiaza_id=%s, want lg_code=%s machiaza_id=%s", lg, mz, tt.wantLgCode, tt.wantMachiaza)
				}
				if !slices.Equal(got.UnmatchedAddress, tt.wantUnmatched) {
					t.Errorf("unmatched_address = %q, want %q", got.UnmatchedAddress, tt.wantUnmatched)
				}
			})
		}
	}
}

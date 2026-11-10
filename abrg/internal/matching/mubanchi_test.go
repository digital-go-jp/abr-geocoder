package matching

import (
	"slices"
	"testing"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
)

// 無番地 states that the place has no lot number, but some machiaza carry it
// in their name, so it is dropped only when the whole address does not match exactly.
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
				got := matchFirst(t, n, tt.addr, category)
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

// An address with 無番地 matches as the address without it does, and reports
// 無番地 as unmatched.
func TestMatchMubanchiSameAsWithout(t *testing.T) {
	n := setupTestMatcher(t)

	tests := []struct {
		name    string
		addr    string
		without string
	}{
		{name: "ward-only address", addr: "中区本町無番地", without: "中区本町"},
		{name: "misspelled koaza", addr: "東京都大島町差木地字クダツチ無番地", without: "東京都大島町差木地字クダツチ"},
		{name: "building after 無番地", addr: "東京都大島町差木地字クダッチ無番地 集会所", without: "東京都大島町差木地字クダッチ 集会所"},
	}

	for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
		for _, tt := range tests {
			t.Run(string(category)+"/"+tt.name, func(t *testing.T) {
				got := matchFirst(t, n, tt.addr, category)
				want := matchFirst(t, n, tt.without, category)
				if got.MatchedAddress != want.MatchedAddress || got.MatchLevel != want.MatchLevel {
					t.Errorf("Match(%q) = [%s] %s, want [%s] %s as for %q",
						tt.addr, got.MatchLevel, got.MatchedAddress, want.MatchLevel, want.MatchedAddress, tt.without)
				}
				if !slices.Contains(got.UnmatchedAddress, mubanchi) {
					t.Errorf("unmatched_address = %q, want it to hold %s", got.UnmatchedAddress, mubanchi)
				}
			})
		}
	}
}

// 無番地 at the end of a building name is part of that name.
func TestMatchMubanchiInBuildingName(t *testing.T) {
	n := setupTestMatcher(t)

	const addr = "東京都千代田区丸の内1-1-1 コーポ無番地"
	for _, category := range []model.Category{model.CategoryBasic, model.CategoryAll} {
		t.Run(string(category), func(t *testing.T) {
			got := matchFirst(t, n, addr, category)
			if !slices.Contains(got.UnmatchedAddress, "コーポ無番地") {
				t.Errorf("unmatched_address = %q, want it to hold コーポ無番地", got.UnmatchedAddress)
			}
		})
	}
}

func matchFirst(t *testing.T, n *Impl, addr string, category model.Category) model.MatchedResult {
	t.Helper()
	resp, err := n.Match(t.Context(), model.MatchQuery{Address: addr, Category: category, Pref: model.All, Limit: 1})
	if err != nil {
		t.Fatalf("Match(%q) error: %v", addr, err)
	}
	if len(resp.Features) == 0 {
		t.Fatalf("Match(%q) returned no results", addr)
	}
	return resp.Features[0]
}

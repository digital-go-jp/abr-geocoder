package matchlevel

import (
	"abrg/internal/model"
	"testing"
)

func TestDetermineMatchLevel(t *testing.T) {
	tests := []struct {
		name      string
		ids       *model.IDs
		wantLevel model.MatchLevel
	}{
		{
			name:      "nil ids returns Unknown",
			ids:       nil,
			wantLevel: model.MatchLevelUnknown,
		},
		{
			name:      "empty ids returns Unknown",
			ids:       &model.IDs{},
			wantLevel: model.MatchLevelUnknown,
		},
		{
			name: "parcel level with PrcID",
			ids: &model.IDs{
				LgCode:     new("131016"),
				MachiazaID: new("0001001"),
				PrcID:      new("prc123"),
			},
			wantLevel: model.MatchLevelParcel,
		},
		{
			name: "residential detail level with RsdtID",
			ids: &model.IDs{
				LgCode:     new("131016"),
				MachiazaID: new("0001001"),
				BlkID:      new("blk123"),
				RsdtID:     new("rsdt123"),
			},
			wantLevel: model.MatchLevelResidentialDetail,
		},
		{
			name: "residential block level with BlkID",
			ids: &model.IDs{
				LgCode:     new("131016"),
				MachiazaID: new("0001001"),
				BlkID:      new("blk123"),
			},
			wantLevel: model.MatchLevelResidentialBlock,
		},
		{
			name: "machiaza detail level - chome suffix",
			ids: &model.IDs{
				LgCode:     new("131016"),
				MachiazaID: new("0001001"), // 001 != 000
			},
			wantLevel: model.MatchLevelMachiazaDetail,
		},
		{
			name: "machiaza level - no chome",
			ids: &model.IDs{
				LgCode:     new("131016"),
				MachiazaID: new("0001000"), // 000
			},
			wantLevel: model.MatchLevelMachiaza,
		},
		{
			name: "city level with LgCode",
			ids: &model.IDs{
				LgCode: new("131016"), // 101 != 000
			},
			wantLevel: model.MatchLevelCity,
		},
		{
			name: "prefecture level with LgCode ending in 000",
			ids: &model.IDs{
				LgCode: new("130001"), // 000 in positions 3-5
			},
			wantLevel: model.MatchLevelPrefecture,
		},
		{
			name: "priority - PrcID over RsdtID",
			ids: &model.IDs{
				LgCode:     new("131016"),
				MachiazaID: new("0001001"),
				BlkID:      new("blk123"),
				RsdtID:     new("rsdt123"),
				PrcID:      new("prc123"),
			},
			wantLevel: model.MatchLevelParcel,
		},
		{
			name: "priority - RsdtID over BlkID",
			ids: &model.IDs{
				LgCode:     new("131016"),
				MachiazaID: new("0001001"),
				BlkID:      new("blk123"),
				RsdtID:     new("rsdt123"),
			},
			wantLevel: model.MatchLevelResidentialDetail,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetermineMatchLevel(tt.ids)
			if got != tt.wantLevel {
				t.Errorf("DetermineMatchLevel() = %v, want %v", got, tt.wantLevel)
			}
		})
	}
}

// TestDetermineMatchLevelMachiazaIDPatterns tests various MachiazaID patterns
func TestDetermineMatchLevelMachiazaIDPatterns(t *testing.T) {
	tests := []struct {
		name       string
		machiazaID string
		wantLevel  model.MatchLevel
	}{
		{
			name:       "machiaza detail - 0001001",
			machiazaID: "0001001",
			wantLevel:  model.MatchLevelMachiazaDetail,
		},
		{
			name:       "machiaza detail - 0002002",
			machiazaID: "0002002",
			wantLevel:  model.MatchLevelMachiazaDetail,
		},
		{
			name:       "machiaza - 0001000",
			machiazaID: "0001000",
			wantLevel:  model.MatchLevelMachiaza,
		},
		{
			name:       "machiaza - 0010000",
			machiazaID: "0010000",
			wantLevel:  model.MatchLevelMachiaza,
		},
		{
			name:       "machiaza detail - 0000001",
			machiazaID: "0000001",
			wantLevel:  model.MatchLevelMachiazaDetail,
		},
		{
			name:       "machiaza - 0000000",
			machiazaID: "0000000",
			wantLevel:  model.MatchLevelMachiaza,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ids := &model.IDs{
				LgCode:     new("131016"),
				MachiazaID: new(tt.machiazaID),
			}
			got := DetermineMatchLevel(ids)
			if got != tt.wantLevel {
				t.Errorf("DetermineMatchLevel(machiazaID=%s) = %v, want %v", tt.machiazaID, got, tt.wantLevel)
			}
		})
	}
}

// TestDetermineMatchLevelLgCodePatterns tests various LgCode patterns
func TestDetermineMatchLevelLgCodePatterns(t *testing.T) {
	tests := []struct {
		name      string
		lgCode    string
		wantLevel model.MatchLevel
	}{
		{
			name:      "city - 131016 (千代田区)",
			lgCode:    "131016",
			wantLevel: model.MatchLevelCity,
		},
		{
			name:      "city - 102016 (前橋市)",
			lgCode:    "102016",
			wantLevel: model.MatchLevelCity,
		},
		{
			name:      "prefecture - 130001 (東京都)",
			lgCode:    "130001",
			wantLevel: model.MatchLevelPrefecture,
		},
		{
			name:      "prefecture - 100001 (群馬県)",
			lgCode:    "100001",
			wantLevel: model.MatchLevelPrefecture,
		},
		{
			name:      "city - 011002 (札幌市)",
			lgCode:    "011002",
			wantLevel: model.MatchLevelCity,
		},
		{
			name:      "prefecture - 010006 (北海道)",
			lgCode:    "010006",
			wantLevel: model.MatchLevelPrefecture,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ids := &model.IDs{
				LgCode: new(tt.lgCode),
			}
			got := DetermineMatchLevel(ids)
			if got != tt.wantLevel {
				t.Errorf("DetermineMatchLevel(lgCode=%s) = %v, want %v", tt.lgCode, got, tt.wantLevel)
			}
		})
	}
}

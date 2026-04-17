package repository

import (
	"testing"

	"abrg/internal/model"
)

func TestBuildIDs_ValidatesLengths(t *testing.T) {
	strPtr := func(s string) *string { return &s }

	tests := []struct {
		name       string
		lgCode     string
		machiazaID string
		wantLg     bool // true if IDs.LgCode should be non-nil
		wantMz     bool // true if IDs.MachiazaID should be non-nil
	}{
		{
			name:       "valid lgCode and machiazaID",
			lgCode:     "131016",
			machiazaID: "0001001",
			wantLg:     true,
			wantMz:     true,
		},
		{
			name:       "empty values produce nil",
			lgCode:     "",
			machiazaID: "",
			wantLg:     false,
			wantMz:     false,
		},
		{
			name:       "too short lgCode treated as nil",
			lgCode:     "1310",
			machiazaID: "0001001",
			wantLg:     false,
			wantMz:     true,
		},
		{
			name:       "too long lgCode treated as nil",
			lgCode:     "1310161",
			machiazaID: "0001001",
			wantLg:     false,
			wantMz:     true,
		},
		{
			name:       "too short machiazaID treated as nil",
			lgCode:     "131016",
			machiazaID: "000100",
			wantLg:     true,
			wantMz:     false,
		},
		{
			name:       "too long machiazaID treated as nil",
			lgCode:     "131016",
			machiazaID: "00010012",
			wantLg:     true,
			wantMz:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ids := buildIDs(tt.lgCode, tt.machiazaID, strPtr("1"), false, 0, 0)
			if (ids.LgCode != nil) != tt.wantLg {
				t.Errorf("LgCode: got nil=%v, want nil=%v", ids.LgCode == nil, !tt.wantLg)
			}
			if tt.wantLg && ids.LgCode != nil && *ids.LgCode != tt.lgCode {
				t.Errorf("LgCode value: got %q, want %q", *ids.LgCode, tt.lgCode)
			}
			if (ids.MachiazaID != nil) != tt.wantMz {
				t.Errorf("MachiazaID: got nil=%v, want nil=%v", ids.MachiazaID == nil, !tt.wantMz)
			}
			if tt.wantMz && ids.MachiazaID != nil && *ids.MachiazaID != tt.machiazaID {
				t.Errorf("MachiazaID value: got %q, want %q", *ids.MachiazaID, tt.machiazaID)
			}
		})
	}
}

func TestBuildIDs_PassesThroughFields(t *testing.T) {
	rsdtFlg := "1"
	ids := buildIDs("131016", "0001001", &rsdtFlg, true, 5, 3)

	if ids.RsdtAddrFlg == nil || *ids.RsdtAddrFlg != "1" {
		t.Errorf("RsdtAddrFlg: got %v, want %q", ids.RsdtAddrFlg, "1")
	}
	if !ids.HasChome {
		t.Error("HasChome: got false, want true")
	}
	if ids.ParcelCount != 5 {
		t.Errorf("ParcelCount: got %d, want 5", ids.ParcelCount)
	}
	if ids.RsdtdspCount != 3 {
		t.Errorf("RsdtdspCount: got %d, want 3", ids.RsdtdspCount)
	}
}

func TestCoordsFromOpt(t *testing.T) {
	fPtr := func(f float64) *float64 { return &f }

	tests := []struct {
		name    string
		lon     *float64
		lat     *float64
		wantNil bool
		wantLon float64
		wantLat float64
	}{
		{name: "both present", lon: fPtr(139.7), lat: fPtr(35.6), wantLon: 139.7, wantLat: 35.6},
		{name: "lon nil", lon: nil, lat: fPtr(35.6), wantNil: true},
		{name: "lat nil", lon: fPtr(139.7), lat: nil, wantNil: true},
		{name: "both nil", lon: nil, lat: nil, wantNil: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := coordsFromOpt(tt.lon, tt.lat)
			if tt.wantNil {
				if got != nil {
					t.Errorf("expected nil, got %v", got)
				}
				return
			}
			if len(got) != 2 {
				t.Fatalf("expected len 2, got %d", len(got))
			}
			if got[0] != tt.wantLon || got[1] != tt.wantLat {
				t.Errorf("got [%f, %f], want [%f, %f]", got[0], got[1], tt.wantLon, tt.wantLat)
			}
		})
	}
}

func TestBuildBaseIDs(t *testing.T) {
	rsdtFlg := "0"
	ids := BuildBaseIDs("131016", "0001001", &rsdtFlg)

	if ids.LgCode == nil || *ids.LgCode != "131016" {
		t.Errorf("LgCode: got %v, want %q", ids.LgCode, "131016")
	}
	if ids.MachiazaID == nil || *ids.MachiazaID != "0001001" {
		t.Errorf("MachiazaID: got %v, want %q", ids.MachiazaID, "0001001")
	}
	if ids.HasChome != false {
		t.Error("HasChome should be false")
	}
	if ids.ParcelCount != 0 {
		t.Errorf("ParcelCount: got %d, want 0", ids.ParcelCount)
	}
}

func TestBasicResultToNormalized(t *testing.T) {
	strPtr := func(s string) *string { return &s }
	fPtr := func(f float64) *float64 { return &f }

	br := &BasicResult{
		Pref: "東京都", City: "千代田区",
		OazaCho:     strPtr("紀尾井町"),
		LgCode:      "131016",
		MachiazaID:  "0001001",
		RsdtAddrFlg: strPtr("1"),
		Lon:         fPtr(139.7),
		Lat:         fPtr(35.6),
	}

	nr := BasicResultToNormalized(br)
	if nr.StructuredAddress.Pref == nil || *nr.StructuredAddress.Pref != "東京都" {
		t.Error("Pref not set")
	}
	if nr.Coordinates == nil || len(nr.Coordinates) != 2 {
		t.Error("Coordinates not set")
	}
	if nr.Score != 1.0 {
		t.Errorf("Score: got %f, want 1.0", nr.Score)
	}
	if nr.MatchLevel == "" || nr.MatchLevel == model.MatchLevelUnknown {
		t.Logf("MatchLevel: %s (depends on matchlevel package)", nr.MatchLevel)
	}
}

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
			ids := BuildIDs(tt.lgCode, tt.machiazaID, strPtr("1"))
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

func TestBuildIDs_PassesThroughRsdtAddrFlg(t *testing.T) {
	rsdtFlg := "1"
	ids := BuildIDs("131016", "0001001", &rsdtFlg)

	if ids.RsdtAddrFlg == nil || *ids.RsdtAddrFlg != "1" {
		t.Errorf("RsdtAddrFlg: got %v, want %q", ids.RsdtAddrFlg, "1")
	}
}

func TestBasicResultToNormalized_CarriesMachiazaData(t *testing.T) {
	br := BasicResult{
		LgCode: "131016", MachiazaID: "0001001", Pref: "東京都", City: "千代田区",
		HasChome: true, ParcelCount: 5, RsdtdspCount: 3,
	}
	got := BasicResultToNormalized(&br).Machiaza

	want := model.MachiazaData{HasChome: true, ParcelCount: 5, RsdtdspCount: 3}
	if got != want {
		t.Errorf("Machiaza: got %+v, want %+v", got, want)
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
		t.Errorf("Pref = %v, want 東京都", nr.StructuredAddress.Pref)
	}
	if nr.StructuredAddress.City == nil || *nr.StructuredAddress.City != "千代田区" {
		t.Errorf("City = %v, want 千代田区", nr.StructuredAddress.City)
	}
	if nr.StructuredAddress.OazaCho == nil || *nr.StructuredAddress.OazaCho != "紀尾井町" {
		t.Errorf("OazaCho = %v, want 紀尾井町", nr.StructuredAddress.OazaCho)
	}
	// Coordinates must be [lon, lat] in that order (guards against a lon/lat swap).
	if len(nr.Coordinates) != 2 {
		t.Fatalf("Coordinates = %v, want len 2", nr.Coordinates)
	}
	if nr.Coordinates[0] != 139.7 || nr.Coordinates[1] != 35.6 {
		t.Errorf("Coordinates = %v, want [139.7, 35.6] (lon, lat)", nr.Coordinates)
	}
	if nr.Score != 1.0 {
		t.Errorf("Score = %f, want 1.0", nr.Score)
	}
	// lg_code 131016 + machiaza_id 0001001 (detail suffix "001") -> machiaza_detail.
	if nr.MatchLevel != model.MatchLevelMachiazaDetail {
		t.Errorf("MatchLevel = %q, want %q", nr.MatchLevel, model.MatchLevelMachiazaDetail)
	}
	if nr.IDs.LgCode == nil || *nr.IDs.LgCode != "131016" {
		t.Errorf("IDs.LgCode = %v, want 131016", nr.IDs.LgCode)
	}
	if nr.IDs.MachiazaID == nil || *nr.IDs.MachiazaID != "0001001" {
		t.Errorf("IDs.MachiazaID = %v, want 0001001", nr.IDs.MachiazaID)
	}
}

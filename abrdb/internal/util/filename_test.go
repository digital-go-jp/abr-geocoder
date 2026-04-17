package util

import "testing"

func TestParseFilePattern(t *testing.T) {
	tests := []struct {
		name     string
		fileName string
		want     FilePattern
	}{
		{
			name:     "all pattern",
			fileName: "mt_pref_all.csv.zip",
			want:     FilePattern{Type: PatternAll},
		},
		{
			name:     "pref pattern single digit",
			fileName: "mt_town_pref1.csv.zip",
			want:     FilePattern{Type: PatternPref, Code: "1", PrefNum: 1},
		},
		{
			name:     "pref pattern double digit",
			fileName: "mt_town_pref13.csv.zip",
			want:     FilePattern{Type: PatternPref, Code: "13", PrefNum: 13},
		},
		{
			name:     "city pattern",
			fileName: "mt_parcel_city131001.csv.zip",
			want:     FilePattern{Type: PatternCity, Code: "131001", PrefNum: 13},
		},
		{
			name:     "pref pattern with pos suffix",
			fileName: "mt_town_pref13_pos.csv.zip",
			want:     FilePattern{Type: PatternPref, Code: "13", PrefNum: 13},
		},
		{
			name:     "city pattern with pos suffix",
			fileName: "mt_parcel_city131001_pos.csv.zip",
			want:     FilePattern{Type: PatternCity, Code: "131001", PrefNum: 13},
		},
		{
			name:     "unknown pattern",
			fileName: "unknown_file.csv",
			want:     FilePattern{Type: PatternUnknown},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ParseFilePattern(tt.fileName)
			if got != tt.want {
				t.Errorf("ParseFilePattern(%q) = %+v, want %+v", tt.fileName, got, tt.want)
			}
		})
	}
}

func TestExtractLocationInfo(t *testing.T) {
	tests := []struct {
		name        string
		fileName    string
		wantPref    int
		wantFileKey string
	}{
		{
			name:        "all pattern",
			fileName:    "mt_pref_all.csv.zip",
			wantPref:    0,
			wantFileKey: "all",
		},
		{
			name:        "pref pattern",
			fileName:    "mt_town_pref13.csv.zip",
			wantPref:    13,
			wantFileKey: "13",
		},
		{
			name:        "city pattern",
			fileName:    "mt_parcel_city131001.csv.zip",
			wantPref:    13,
			wantFileKey: "131001",
		},
		{
			name:        "unknown pattern",
			fileName:    "unknown.csv",
			wantPref:    0,
			wantFileKey: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotPref, gotFileKey := ExtractLocationInfo(tt.fileName)
			if gotPref != tt.wantPref || gotFileKey != tt.wantFileKey {
				t.Errorf("ExtractLocationInfo(%q) = (%d, %q), want (%d, %q)",
					tt.fileName, gotPref, gotFileKey, tt.wantPref, tt.wantFileKey)
			}
		})
	}
}

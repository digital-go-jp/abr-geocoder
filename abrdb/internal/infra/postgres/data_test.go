package postgres

import "testing"

func TestBuildDeleteCondition(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		want     string
	}{
		{
			name:     "pref pattern - zero padding",
			filename: "mt_rsdtdsp_blk_pref13.csv.zip",
			want:     "lg_code >= '13' AND lg_code < '14'",
		},
		{
			name:     "pref pattern - single digit zero padded",
			filename: "mt_rsdtdsp_blk_pref1.csv.zip",
			want:     "lg_code >= '01' AND lg_code < '02'",
		},
		{
			name:     "city pattern",
			filename: "mt_parcel_city131001.csv.zip",
			want:     "lg_code = '131001'",
		},
		{
			name:     "city pattern with pos",
			filename: "mt_parcel_pos_city271001.csv.zip",
			want:     "lg_code = '271001'",
		},
		{
			name:     "all pattern",
			filename: "mt_pref_all.csv.zip",
			want:     "1=1",
		},
		{
			name:     "unknown pattern",
			filename: "unknown_file.csv.zip",
			want:     "1=0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildDeleteCondition(tt.filename)
			if got != tt.want {
				t.Errorf("buildDeleteCondition(%q) = %q, want %q", tt.filename, got, tt.want)
			}
		})
	}
}

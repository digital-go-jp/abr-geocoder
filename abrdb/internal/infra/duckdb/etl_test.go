package duckdb

import (
	"strings"
	"testing"

	"abr.local/common/db"
)

// buildPostgresAttachSQL is tested here because it's a private function
// specific to the duckdb package. Comprehensive tests for BuildPostgresSecretSQL
// are in common/db/postgres_secret_test.go.
func TestBuildPostgresAttachSQL(t *testing.T) {
	cases := []struct {
		name    string
		sslMode string
		want    string
	}{
		{
			name:    "with sslmode",
			sslMode: "require",
			want:    "ATTACH 'sslmode=require' AS pg (TYPE postgres, SECRET abrdb_pg_secret)",
		},
		{
			name:    "empty sslmode",
			sslMode: "",
			want:    "ATTACH '' AS pg (TYPE postgres, SECRET abrdb_pg_secret)",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := buildPostgresAttachSQL(tc.sslMode, "abrdb_pg_secret")
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

// Regression test: password must not leak into ATTACH SQL (credentials only in SECRET).
func TestBuildPostgresSecretSQL_DoesNotAppearInAttachSQL(t *testing.T) {
	cfg := db.DBConfig{
		Host: "h", Port: "5432", Database: "d", User: "u",
		Password: "super_secret_pw_do_not_leak",
		SSLMode:  "require",
	}
	attachSQL := buildPostgresAttachSQL(cfg.SSLMode, "s")
	if strings.Contains(attachSQL, cfg.Password) {
		t.Errorf("password leaked into ATTACH SQL: %s", attachSQL)
	}
}

func TestGenerateTableNames(t *testing.T) {
	tests := []struct {
		name       string
		suffix     string
		wantText   string
		wantPos    string
		wantTransf string
	}{
		{
			name:       "empty suffix",
			suffix:     "",
			wantText:   "text_data",
			wantPos:    "pos_data",
			wantTransf: "transformed",
		},
		{
			name:       "with suffix",
			suffix:     "_123",
			wantText:   "text_data_123",
			wantPos:    "pos_data_123",
			wantTransf: "transformed_123",
		},
		{
			name:       "unique suffix for parallel execution",
			suffix:     "_abc_456",
			wantText:   "text_data_abc_456",
			wantPos:    "pos_data_abc_456",
			wantTransf: "transformed_abc_456",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := generateTableNames(tt.suffix)
			if got.Text != tt.wantText {
				t.Errorf("generateTableNames(%q).Text = %q, want %q", tt.suffix, got.Text, tt.wantText)
			}
			if got.Pos != tt.wantPos {
				t.Errorf("generateTableNames(%q).Pos = %q, want %q", tt.suffix, got.Pos, tt.wantPos)
			}
			if got.Transformed != tt.wantTransf {
				t.Errorf("generateTableNames(%q).Transformed = %q, want %q", tt.suffix, got.Transformed, tt.wantTransf)
			}
		})
	}
}

func TestGenerateTableNames_Uniqueness(t *testing.T) {
	// Verify that different suffixes produce different table names
	names1 := generateTableNames("_1")
	names2 := generateTableNames("_2")

	if names1.Text == names2.Text {
		t.Errorf("generateTableNames(_1).Text = %q, generateTableNames(_2).Text = %q, want different", names1.Text, names2.Text)
	}
	if names1.Pos == names2.Pos {
		t.Errorf("generateTableNames(_1).Pos = %q, generateTableNames(_2).Pos = %q, want different", names1.Pos, names2.Pos)
	}
	if names1.Transformed == names2.Transformed {
		t.Errorf("generateTableNames(_1).Transformed = %q, generateTableNames(_2).Transformed = %q, want different", names1.Transformed, names2.Transformed)
	}
}

func TestBuildDeleteCondition(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		want     string
	}{
		{
			name:     "pref pattern - zero padding",
			filename: "mt_rsdtdsp_blk_pref13.csv.zip",
			want:     "SUBSTR(lg_code, 1, 2) = '13'",
		},
		{
			name:     "pref pattern - single digit zero padded",
			filename: "mt_rsdtdsp_blk_pref1.csv.zip",
			want:     "SUBSTR(lg_code, 1, 2) = '01'",
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

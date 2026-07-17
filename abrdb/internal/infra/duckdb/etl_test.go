package duckdb

import (
	"regexp"
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
		{
			name:       "dots in suffix are sanitized to underscores",
			suffix:     "_a.b",
			wantText:   "text_data_a_b",
			wantPos:    "pos_data_a_b",
			wantTransf: "transformed_a_b",
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

func TestGenerateTableNames_SanitizesIdentifier(t *testing.T) {
	// Table names are interpolated into SQL as identifiers (cannot be parameterized),
	// so a crafted source filename must not smuggle SQL metacharacters through.
	identOnly := regexp.MustCompile(`^[A-Za-z0-9_]+$`)
	hostile := []string{
		`_'; DROP TABLE users; --`,
		`_a"b`,
		"_a`b",
		"_mt pref-all",
		"_x;y",
		"_日本語",
	}
	for _, suffix := range hostile {
		t.Run(suffix, func(t *testing.T) {
			tn := generateTableNames(suffix)
			for _, name := range []string{tn.Text, tn.Pos, tn.Transformed} {
				if !identOnly.MatchString(name) {
					t.Errorf("table name %q contains non-identifier characters (suffix %q)", name, suffix)
				}
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

func TestBuildWhereClause(t *testing.T) {
	tests := []struct {
		name    string
		filters map[string][]string
		want    string
	}{
		{
			name:    "nil filters",
			filters: nil,
			want:    "",
		},
		{
			name:    "single column single value",
			filters: map[string][]string{"pref": {"01"}},
			want:    "pref IN ('01')",
		},
		{
			name:    "single column multiple values keep order",
			filters: map[string][]string{"pref": {"01", "02", "03"}},
			want:    "pref IN ('01', '02', '03')",
		},
		{
			name:    "single quotes are escaped",
			filters: map[string][]string{"name": {"O'Brien"}},
			want:    "name IN ('O''Brien')",
		},
		{
			name:    "empty value list is skipped",
			filters: map[string][]string{"pref": {}},
			want:    "",
		},
		{
			// A column with no values is skipped, leaving a single deterministic clause.
			// (For multiple populated columns the AND order follows map iteration,
			// which is unspecified, so those are not asserted here.)
			name:    "empty column skipped, populated column kept",
			filters: map[string][]string{"pref": {"13"}, "skip": {}},
			want:    "pref IN ('13')",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := buildWhereClause(tt.filters); got != tt.want {
				t.Errorf("buildWhereClause(%v) = %q, want %q", tt.filters, got, tt.want)
			}
		})
	}
}

package schema

import (
	"strings"
	"testing"

	"abrdb/internal/model"
)

func TestPgTypeToDuckDB(t *testing.T) {
	tests := []struct {
		name   string
		pgType string
		want   string
	}{
		{"text", "TEXT", "VARCHAR"},
		{"smallint", "SMALLINT", "SMALLINT"},
		{"integer", "INTEGER", "INTEGER"},
		{"double precision", "DOUBLE PRECISION", "DOUBLE"},
		{"real maps to float", "REAL", "FLOAT"},
		{"date", "DATE", "DATE"},
		{"char with length", "CHAR(6)", "VARCHAR"},
		{"char short", "CHAR(2)", "VARCHAR"},
		{"character varying prefix", "CHARACTER VARYING", "VARCHAR"},
		{"unknown type falls back to varchar", "JSONB", "VARCHAR"},
		{"empty falls back to varchar", "", "VARCHAR"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := pgTypeToDuckDB(tt.pgType); got != tt.want {
				t.Errorf("pgTypeToDuckDB(%q) = %q, want %q", tt.pgType, got, tt.want)
			}
		})
	}
}

// validConfig returns a minimal config that passes Validate; tests mutate it to
// exercise individual failure branches.
func validConfig() *ImportConfig {
	return &ImportConfig{
		Version: 1,
		Category: map[string]*CategoryConfig{
			string(model.CategoryPref): {
				TableName:   "mt_pref_unified",
				TextColumns: []ColumnDef{{Name: "lg_code", Type: "CHAR(6)"}},
				PosColumns:  []ColumnDef{{Name: "lg_code", Type: "CHAR(6)"}},
				JoinColumns: []string{"lg_code"},
			},
		},
	}
}

func TestImportConfig_Validate(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*ImportConfig)
		wantErr string // substring of expected error; "" means expect nil
	}{
		{"valid", func(*ImportConfig) {}, ""},
		{"unsupported version", func(c *ImportConfig) { c.Version = 2 }, "unsupported config version"},
		{"no category", func(c *ImportConfig) { c.Category = nil }, "no category defined"},
		{"unknown category name", func(c *ImportConfig) {
			c.Category["mt_bogus"] = c.Category[string(model.CategoryPref)]
		}, "unknown category"},
		{"missing text_columns", func(c *ImportConfig) {
			c.Category[string(model.CategoryPref)].TextColumns = nil
		}, "text_columns is required"},
		{"missing pos_columns", func(c *ImportConfig) {
			c.Category[string(model.CategoryPref)].PosColumns = nil
		}, "pos_columns is required"},
		{"missing join_columns", func(c *ImportConfig) {
			c.Category[string(model.CategoryPref)].JoinColumns = nil
		}, "join_columns is required"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := validConfig()
			tt.mutate(c)
			err := c.Validate()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("Validate() = %v, want nil", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("Validate() = nil, want error containing %q", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("Validate() error = %q, want containing %q", err.Error(), tt.wantErr)
			}
		})
	}
}

func TestCategoryConfig_MergeColumns(t *testing.T) {
	cat := &CategoryConfig{
		TextColumns: []ColumnDef{{Name: "lg_code", Type: "CHAR(6)"}, {Name: "pref", Type: "TEXT"}},
		PosColumns:  []ColumnDef{{Name: "lg_code", Type: "CHAR(6)"}, {Name: "rep_lon", Type: "REAL"}},
	}
	got := cat.mergeColumns()

	// lg_code is shared between text and pos columns and must appear once, with
	// text columns first and pos-only columns appended.
	want := []string{"lg_code", "pref", "rep_lon"}
	if len(got) != len(want) {
		names := make([]string, len(got))
		for i, c := range got {
			names[i] = c.Name
		}
		t.Fatalf("mergeColumns() = %v, want %v", names, want)
	}
	for i, name := range want {
		if got[i].Name != name {
			t.Errorf("mergeColumns()[%d].Name = %q, want %q", i, got[i].Name, name)
		}
	}
}

func TestCategoryConfig_GenerateDDL(t *testing.T) {
	cat := &CategoryConfig{
		TableName: "mt_pref_unified",
		TextColumns: []ColumnDef{
			{Name: "lg_code", Type: "CHAR(6)", Nullable: false},
			{Name: "pref", Type: "TEXT", Nullable: false},
		},
		PosColumns: []ColumnDef{
			{Name: "lg_code", Type: "CHAR(6)", Nullable: false},
			{Name: "rep_lon", Type: "REAL", Nullable: true},
		},
	}
	ddl := cat.GenerateDDL()

	// GenerateDDL emits PostgreSQL DDL using the raw column types (not the DuckDB
	// mapping), with NOT NULL on non-nullable columns and a comma on all but the last.
	for _, want := range []string{
		"DROP TABLE IF EXISTS mt_pref_unified CASCADE;",
		"CREATE TABLE IF NOT EXISTS mt_pref_unified (",
		"CHAR(6) NOT NULL,", // non-nullable, not last -> NOT NULL + comma
		"TEXT NOT NULL,",
	} {
		if !strings.Contains(ddl, want) {
			t.Errorf("GenerateDDL() missing %q\nDDL:\n%s", want, ddl)
		}
	}
	// rep_lon is the last (merged) column and nullable: no NOT NULL, no trailing comma.
	if !strings.Contains(ddl, "REAL\n);") {
		t.Errorf("GenerateDDL() last column should be 'REAL' with no NOT NULL/comma\nDDL:\n%s", ddl)
	}
	if strings.Contains(ddl, "REAL NOT NULL") {
		t.Errorf("GenerateDDL() nullable rep_lon must not be NOT NULL\nDDL:\n%s", ddl)
	}
	// lg_code is deduped, so it appears exactly once in the DDL. The lg_code
	// index is not part of the DDL: it is created after the initial import
	// (see postgres.EnsureLgCodeIndex).
	if n := strings.Count(ddl, "lg_code"); n != 1 {
		t.Errorf("GenerateDDL() lg_code appears %d times, want 1 (deduped)\nDDL:\n%s", n, ddl)
	}
}

func TestCategoryConfig_ToCategoryInfo(t *testing.T) {
	cat := &CategoryConfig{
		TableName:  "t",
		S3TextPath: "tp/",
		S3PosPath:  "pp/",
		TextColumns: []ColumnDef{
			{Name: "lg_code", Type: "CHAR(6)"},
			{Name: "rsdt_num", Type: "INTEGER", ConvertFullwidth: true},
		},
		PosColumns: []ColumnDef{
			{Name: "lg_code", Type: "CHAR(6)"},
			{Name: "rep_lon", Type: "REAL"},
		},
		JoinColumns: []string{"lg_code"},
		Filters:     &FilterConfig{"pref": {"01"}},
	}
	info := cat.toCategoryInfo()

	// Only text columns explicitly flagged convert_fullwidth are tracked.
	if !info.FullwidthColumns["rsdt_num"] {
		t.Error("FullwidthColumns should include rsdt_num")
	}
	if info.FullwidthColumns["lg_code"] {
		t.Error("FullwidthColumns must not include unflagged lg_code")
	}
	if len(info.FullwidthColumns) != 1 {
		t.Errorf("FullwidthColumns = %v, want only rsdt_num", info.FullwidthColumns)
	}

	// Column types are mapped to DuckDB types.
	if got := info.TextColumnTypes["lg_code"]; got != "VARCHAR" {
		t.Errorf("TextColumnTypes[lg_code] = %q, want VARCHAR", got)
	}
	if got := info.TextColumnTypes["rsdt_num"]; got != "INTEGER" {
		t.Errorf("TextColumnTypes[rsdt_num] = %q, want INTEGER", got)
	}
	if got := info.PosColumnTypes["rep_lon"]; got != "FLOAT" {
		t.Errorf("PosColumnTypes[rep_lon] = %q, want FLOAT", got)
	}

	// Filters are passed through.
	if got := info.Filters["pref"]; len(got) != 1 || got[0] != "01" {
		t.Errorf("Filters[pref] = %v, want [01]", got)
	}
}

// TestParseImportConfig_EmbeddedDefault guards the shipped default config: a
// broken config_default.yaml would otherwise only surface at `abrdb init` time.
func TestParseImportConfig_EmbeddedDefault(t *testing.T) {
	cfg, err := ParseImportConfig(DefaultConfigYAML)
	if err != nil {
		t.Fatalf("ParseImportConfig(DefaultConfigYAML) error = %v", err)
	}
	if cfg.Version != 1 {
		t.Errorf("Version = %d, want 1", cfg.Version)
	}
	for _, cat := range model.AllCategory {
		if cfg.Category[string(cat)] == nil {
			t.Errorf("default config missing category %q", cat)
		}
	}
	info := cfg.ToCategoryInfoMap()
	if len(info) != len(cfg.Category) {
		t.Errorf("ToCategoryInfoMap() = %d entries, want %d", len(info), len(cfg.Category))
	}
	if ddl := cfg.GenerateDDL(); !strings.Contains(ddl, "CREATE TABLE IF NOT EXISTS mt_pref_unified") {
		t.Errorf("GenerateDDL() missing mt_pref table\n%s", ddl)
	}
}

func TestParseImportConfig_Errors(t *testing.T) {
	// Malformed YAML surfaces as a parse error.
	if _, err := ParseImportConfig([]byte("version: notanumber")); err == nil {
		t.Error("ParseImportConfig(malformed) = nil error, want parse error")
	}
	// Well-formed YAML but a semantically invalid config surfaces as a validate error.
	yaml := "version: 2\n" +
		"category:\n" +
		"  mt_pref:\n" +
		"    text_columns:\n" +
		"      - {name: x, type: TEXT}\n" +
		"    pos_columns:\n" +
		"      - {name: x, type: TEXT}\n" +
		"    join_columns: [x]\n"
	if _, err := ParseImportConfig([]byte(yaml)); err == nil {
		t.Error("ParseImportConfig(version 2) = nil error, want validate error")
	}
}

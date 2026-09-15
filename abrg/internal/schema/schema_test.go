package schema

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestLoadSchema(t *testing.T) {
	schema, err := loadSchema()
	if err != nil {
		t.Fatalf("loadSchema() error = %v", err)
	}

	if schema.Version != 4 {
		t.Errorf("schema.Version = %d, want 4", schema.Version)
	}

	expectedTables := []string{"cache_machiaza", "cache_city", "cache_pref", "cache_config"}
	for _, tableName := range expectedTables {
		if _, ok := schema.Tables[tableName]; !ok {
			t.Errorf("schema.Tables[%q] not found", tableName)
		}
	}

	// Category tables are created by CTAS in cache/sql.go, not declared in YAML.
	for _, tableName := range []string{"cache_rsdtdsp", "cache_parcel"} {
		if _, ok := schema.Tables[tableName]; ok {
			t.Errorf("schema.Tables[%q] found, category tables must not be declared in YAML", tableName)
		}
	}
}

func Test_generateCreateTableSQL(t *testing.T) {
	schema, err := loadSchema()
	if err != nil {
		t.Fatalf("loadSchema() error = %v", err)
	}

	table := schema.Tables["cache_machiaza"]
	sql := table.generateCreateTableSQL("cache_machiaza")

	if !strings.Contains(sql, "CREATE TABLE IF NOT EXISTS cache_machiaza") {
		t.Error("SQL should contain CREATE TABLE statement")
	}
	if !strings.Contains(sql, "pref_code SMALLINT") {
		t.Error("SQL should contain pref_code column")
	}
	if !strings.Contains(sql, "lon FLOAT") || !strings.Contains(sql, "lat FLOAT") {
		t.Error("SQL should contain lon and lat columns")
	}
}

func Test_generateIndexSQL(t *testing.T) {
	schema, err := loadSchema()
	if err != nil {
		t.Fatalf("loadSchema() error = %v", err)
	}

	table := schema.Tables["cache_machiaza"]
	sql := table.generateIndexSQL("cache_machiaza")

	if !strings.Contains(sql, "CREATE INDEX IF NOT EXISTS") {
		t.Error("SQL should contain CREATE INDEX statement")
	}
	if !strings.Contains(sql, "idx_machiaza_normalized") {
		t.Error("SQL should contain idx_machiaza_normalized index")
	}
}

func TestInitSchemaSQL(t *testing.T) {
	sql, err := InitSchemaSQL()
	if err != nil {
		t.Fatalf("InitSchemaSQL() error = %v", err)
	}

	if !strings.Contains(sql, "cache_machiaza") {
		t.Error("InitSchemaSQL should contain cache_machiaza")
	}
	if !strings.Contains(sql, "cache_city") {
		t.Error("InitSchemaSQL should contain cache_city")
	}
	if !strings.Contains(sql, "cache_pref") {
		t.Error("InitSchemaSQL should contain cache_pref")
	}
	// Category tables come from CTAS at build time, so the init SQL must not touch them.
	if strings.Contains(sql, "cache_rsdtdsp") {
		t.Error("InitSchemaSQL should not contain cache_rsdtdsp")
	}
	if strings.Contains(sql, "cache_parcel") {
		t.Error("InitSchemaSQL should not contain cache_parcel")
	}

	if !strings.Contains(sql, "DELETE FROM cache_machiaza") {
		t.Error("InitSchemaSQL should contain DELETE FROM cache_machiaza")
	}
}

func TestGetCreateIndexesSQL(t *testing.T) {
	sql, err := GetCreateIndexesSQL()
	if err != nil {
		t.Fatalf("GetCreateIndexesSQL() error = %v", err)
	}
	if sql == "" {
		t.Error("GetCreateIndexesSQL should not return empty")
	}
	if !strings.Contains(sql, "CREATE INDEX") {
		t.Error("GetCreateIndexesSQL should contain CREATE INDEX")
	}
}

func TestColumnConfigConstraints(t *testing.T) {
	yamlData := `
name: config_key
type: VARCHAR
constraints: "PRIMARY KEY"
`
	var col columnConfig
	if err := yaml.Unmarshal([]byte(yamlData), &col); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if col.Name != "config_key" {
		t.Errorf("col.Name = %q, want %q", col.Name, "config_key")
	}
	if col.Type != "VARCHAR" {
		t.Errorf("col.Type = %q, want %q", col.Type, "VARCHAR")
	}
	if col.Constraints != "PRIMARY KEY" {
		t.Errorf("col.Constraints = %q, want %q", col.Constraints, "PRIMARY KEY")
	}
}

func Test_generateCreateTableSQL_WithConstraints(t *testing.T) {
	schema, err := loadSchema()
	if err != nil {
		t.Fatalf("loadSchema() error = %v", err)
	}

	table := schema.Tables["cache_config"]
	if table == nil {
		t.Fatal("cache_config table not found in schema")
	}

	sql := table.generateCreateTableSQL("cache_config")

	if !strings.Contains(sql, "config_key VARCHAR PRIMARY KEY") {
		t.Errorf("DDL should contain 'config_key VARCHAR PRIMARY KEY', got:\n%s", sql)
	}
	if !strings.Contains(sql, "config_value VARCHAR") {
		t.Errorf("DDL should contain 'config_value VARCHAR', got:\n%s", sql)
	}
}

func TestInsertMachiazaColumnCount(t *testing.T) {
	schema, err := loadSchema()
	if err != nil {
		t.Fatalf("loadSchema() error = %v", err)
	}

	table := schema.Tables["cache_machiaza"]
	colCount := len(table.Columns)

	// The explicit column list of INSERT INTO cache_machiaza in cache/sql.go must
	// match the YAML schema.
	if colCount != 20 {
		t.Errorf("cache_machiaza column count = %d, want 20", colCount)
	}
}

func TestCacheCityColumnCount(t *testing.T) {
	schema, err := loadSchema()
	if err != nil {
		t.Fatalf("loadSchema() error = %v", err)
	}

	table := schema.Tables["cache_city"]
	if table == nil {
		t.Fatal("cache_city table not found in schema")
	}

	colCount := len(table.Columns)
	if colCount != 9 {
		t.Errorf("cache_city column count = %d, want 9", colCount)
	}
}

func TestCachePrefColumnCount(t *testing.T) {
	schema, err := loadSchema()
	if err != nil {
		t.Fatalf("loadSchema() error = %v", err)
	}

	table := schema.Tables["cache_pref"]
	if table == nil {
		t.Fatal("cache_pref table not found in schema")
	}

	colCount := len(table.Columns)
	if colCount != 6 {
		t.Errorf("cache_pref column count = %d, want 6", colCount)
	}
}

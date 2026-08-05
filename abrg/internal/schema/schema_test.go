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

	if schema.Version != 3 {
		t.Errorf("schema.Version = %d, want 3", schema.Version)
	}

	// Check tables exist
	expectedTables := []string{"cache_machiaza", "cache_city", "cache_pref", "cache_config"}
	for _, tableName := range expectedTables {
		if _, ok := schema.Tables[tableName]; !ok {
			t.Errorf("schema.Tables[%q] not found", tableName)
		}
	}

	// Category tables are created at build time by CTAS (cache/sql.go), not
	// declared in the YAML schema.
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
	if !strings.Contains(sql, "geom GEOMETRY") {
		t.Error("SQL should contain geom column")
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

func Test_generateSpatialIndexSQL(t *testing.T) {
	schema, err := loadSchema()
	if err != nil {
		t.Fatalf("loadSchema() error = %v", err)
	}

	table := schema.Tables["cache_machiaza"]
	sql := table.generateSpatialIndexSQL("cache_machiaza")

	if !strings.Contains(sql, "USING RTREE") {
		t.Error("SQL should contain USING RTREE for spatial index")
	}
	if !strings.Contains(sql, "idx_machiaza_geom") {
		t.Error("SQL should contain idx_machiaza_geom index")
	}
}

func TestInitSchemaSQL(t *testing.T) {
	sql, err := InitSchemaSQL()
	if err != nil {
		t.Fatalf("InitSchemaSQL() error = %v", err)
	}

	// Should contain CREATE TABLE for all tables
	if !strings.Contains(sql, "cache_machiaza") {
		t.Error("InitSchemaSQL should contain cache_machiaza")
	}
	if !strings.Contains(sql, "cache_city") {
		t.Error("InitSchemaSQL should contain cache_city")
	}
	if !strings.Contains(sql, "cache_pref") {
		t.Error("InitSchemaSQL should contain cache_pref")
	}
	// Category tables come from CTAS at build time; the init SQL must not
	// create (or clear) them.
	if strings.Contains(sql, "cache_rsdtdsp") {
		t.Error("InitSchemaSQL should not contain cache_rsdtdsp")
	}
	if strings.Contains(sql, "cache_parcel") {
		t.Error("InitSchemaSQL should not contain cache_parcel")
	}

	// Should contain DELETE statements
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

func TestGetCreateSpatialIndexesSQL(t *testing.T) {
	sql, err := GetCreateSpatialIndexesSQL()
	if err != nil {
		t.Fatalf("GetCreateSpatialIndexesSQL() error = %v", err)
	}
	if sql == "" {
		t.Error("GetCreateSpatialIndexesSQL should not return empty")
	}
	if !strings.Contains(sql, "RTREE") {
		t.Error("GetCreateSpatialIndexesSQL should contain RTREE")
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

	// The INSERT INTO cache_machiaza SQL in sql.go must have an explicit column list
	// that matches the YAML schema. This test validates the column count.
	if colCount != 19 {
		t.Errorf("cache_machiaza column count = %d, want 19", colCount)
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
	if colCount != 8 {
		t.Errorf("cache_city column count = %d, want 8", colCount)
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
	if colCount != 5 {
		t.Errorf("cache_pref column count = %d, want 5", colCount)
	}
}

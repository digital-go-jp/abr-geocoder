// Package schema provides DuckDB cache schema configuration and SQL generation.
package schema

import (
	"fmt"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

// cacheSchema represents the full cache schema configuration.
type cacheSchema struct {
	Version int                     `yaml:"version"`
	Tables  map[string]*tableConfig `yaml:"tables"`
}

// tableConfig represents a single table configuration.
type tableConfig struct {
	Columns        []columnConfig `yaml:"columns"`
	Indexes        []indexConfig  `yaml:"indexes"`
	SpatialIndexes []indexConfig  `yaml:"spatial_indexes"`
}

// columnConfig represents a column definition.
type columnConfig struct {
	Name        string `yaml:"name"`
	Type        string `yaml:"type"`
	Default     string `yaml:"default,omitempty"`
	Constraints string `yaml:"constraints,omitempty"`
}

// indexConfig represents an index definition.
type indexConfig struct {
	Name    string   `yaml:"name"`
	Column  string   `yaml:"column,omitempty"`  // for spatial indexes
	Columns []string `yaml:"columns,omitempty"` // for regular indexes
}

var loadSchemaOnce = sync.OnceValues(func() (*cacheSchema, error) {
	var schema cacheSchema
	if err := yaml.Unmarshal(cacheSchemaYAML, &schema); err != nil {
		return nil, fmt.Errorf("parse cache schema: %w", err)
	}
	return &schema, nil
})

// loadSchema loads and parses the embedded cache schema.
// Thread-safe and cached after first call.
func loadSchema() (*cacheSchema, error) {
	return loadSchemaOnce()
}

// Version returns the cache schema version declared in cache_schema.yaml.
// It is written to cache_config at build time and checked when a cache is
// opened, so a cache built for a different schema fails fast instead of
// surfacing as SQL errors at query time.
func Version() (int, error) {
	s, err := loadSchema()
	if err != nil {
		return 0, err
	}
	return s.Version, nil
}

// generateCreateTableSQL generates CREATE TABLE SQL for a table.
func (t *tableConfig) generateCreateTableSQL(tableName string) string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "CREATE TABLE IF NOT EXISTS %s (\n", tableName)

	for i, col := range t.Columns {
		fmt.Fprintf(&sb, "\t%s %s", col.Name, col.Type)
		if col.Constraints != "" {
			fmt.Fprintf(&sb, " %s", col.Constraints)
		}
		if col.Default != "" {
			fmt.Fprintf(&sb, " DEFAULT %s", col.Default)
		}
		if i < len(t.Columns)-1 {
			sb.WriteString(",")
		}
		sb.WriteString("\n")
	}

	sb.WriteString(")")
	return sb.String()
}

// generateIndexSQL generates CREATE INDEX SQL for regular indexes.
func (t *tableConfig) generateIndexSQL(tableName string) string {
	var sb strings.Builder
	for _, idx := range t.Indexes {
		cols := strings.Join(idx.Columns, ", ")
		fmt.Fprintf(&sb, "CREATE INDEX IF NOT EXISTS %s ON %s(%s);\n", idx.Name, tableName, cols)
	}
	return sb.String()
}

// generateSpatialIndexSQL generates CREATE INDEX SQL for spatial indexes.
func (t *tableConfig) generateSpatialIndexSQL(tableName string) string {
	var sb strings.Builder
	for _, idx := range t.SpatialIndexes {
		fmt.Fprintf(&sb, "CREATE INDEX IF NOT EXISTS %s ON %s USING RTREE(%s);\n", idx.Name, tableName, idx.Column)
	}
	return sb.String()
}

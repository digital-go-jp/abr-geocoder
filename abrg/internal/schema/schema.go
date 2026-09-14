// Package schema provides DuckDB cache schema configuration and SQL generation.
package schema

import (
	"fmt"
	"strings"
	"sync"

	"gopkg.in/yaml.v3"
)

// cacheSchema is the parsed cache_schema.yaml.
type cacheSchema struct {
	Version int                     `yaml:"version"`
	Tables  map[string]*tableConfig `yaml:"tables"`
}

type tableConfig struct {
	Columns []columnConfig `yaml:"columns"`
	Indexes []indexConfig  `yaml:"indexes"`
}

type columnConfig struct {
	Name        string `yaml:"name"`
	Type        string `yaml:"type"`
	Default     string `yaml:"default,omitempty"`
	Constraints string `yaml:"constraints,omitempty"`
}

type indexConfig struct {
	Name    string   `yaml:"name"`
	Columns []string `yaml:"columns"`
}

var loadSchemaOnce = sync.OnceValues(func() (*cacheSchema, error) {
	var schema cacheSchema
	if err := yaml.Unmarshal(cacheSchemaYAML, &schema); err != nil {
		return nil, fmt.Errorf("parse cache schema: %w", err)
	}
	return &schema, nil
})

// loadSchema returns the embedded cache schema, parsed once.
func loadSchema() (*cacheSchema, error) {
	return loadSchemaOnce()
}

// Version returns the schema version in cache_schema.yaml. It is written to
// cache_config at build time and checked on open, so a cache built for another
// schema fails fast instead of causing SQL errors at query time.
func Version() (int, error) {
	s, err := loadSchema()
	if err != nil {
		return 0, err
	}
	return s.Version, nil
}

// generateCreateTableSQL returns the CREATE TABLE statement for tableName.
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

// generateIndexSQL returns the CREATE INDEX statements for tableName.
func (t *tableConfig) generateIndexSQL(tableName string) string {
	var sb strings.Builder
	for _, idx := range t.Indexes {
		cols := strings.Join(idx.Columns, ", ")
		fmt.Fprintf(&sb, "CREATE INDEX IF NOT EXISTS %s ON %s(%s);\n", idx.Name, tableName, cols)
	}
	return sb.String()
}

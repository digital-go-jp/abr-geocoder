package schema

import (
	"fmt"
	"maps"
	"slices"
	"strings"
	"sync"
)

// GetCreateIndexesSQL returns the CREATE INDEX statements, generated once.
var GetCreateIndexesSQL = sync.OnceValues(func() (string, error) {
	schema, err := loadSchema()
	if err != nil {
		return "", fmt.Errorf("failed to load schema: %w", err)
	}

	var sb strings.Builder
	// Iterate in sorted order so the generated SQL is deterministic.
	for _, tableName := range slices.Sorted(maps.Keys(schema.Tables)) {
		sb.WriteString(schema.Tables[tableName].generateIndexSQL(tableName))
	}
	return sb.String(), nil
})

// InitSchemaSQL returns SQL that creates every schema table.
func InitSchemaSQL() (string, error) {
	schema, err := loadSchema()
	if err != nil {
		return "", fmt.Errorf("failed to load schema: %w", err)
	}

	var sb strings.Builder

	// Sorted so the generated SQL is deterministic.
	for _, tableName := range slices.Sorted(maps.Keys(schema.Tables)) {
		sb.WriteString(schema.Tables[tableName].generateCreateTableSQL(tableName))
		sb.WriteString(";\n")
	}

	return sb.String(), nil
}

package schema

import (
	"fmt"
	"strings"
	"sync"
)

// sqlStrings holds pre-generated SQL strings for cache operations.
type sqlStrings struct {
	createIndexes        string
	createSpatialIndexes string
	clearCache           string
}

var loadSQLStrings = sync.OnceValues(func() (*sqlStrings, error) {
	schema, err := loadSchema()
	if err != nil {
		return nil, fmt.Errorf("failed to load schema: %w", err)
	}

	var indexSB, spatialSB, clearSB strings.Builder
	for tableName, table := range schema.Tables {
		indexSB.WriteString(table.generateIndexSQL(tableName))
		spatialSB.WriteString(table.generateSpatialIndexSQL(tableName))
		fmt.Fprintf(&clearSB, "DELETE FROM %s;\n", tableName)
	}

	return &sqlStrings{
		createIndexes:        indexSB.String(),
		createSpatialIndexes: spatialSB.String(),
		clearCache:           clearSB.String(),
	}, nil
})

// GetCreateIndexesSQL returns SQL for creating regular indexes.
// Thread-safe and cached after first call.
func GetCreateIndexesSQL() (string, error) {
	s, err := loadSQLStrings()
	if err != nil {
		return "", err
	}
	return s.createIndexes, nil
}

// GetCreateSpatialIndexesSQL returns SQL for creating spatial indexes.
// Thread-safe and cached after first call.
func GetCreateSpatialIndexesSQL() (string, error) {
	s, err := loadSQLStrings()
	if err != nil {
		return "", err
	}
	return s.createSpatialIndexes, nil
}

// getClearCacheSQL returns SQL for clearing all cache tables.
// Thread-safe and cached after first call.
func getClearCacheSQL() (string, error) {
	s, err := loadSQLStrings()
	if err != nil {
		return "", err
	}
	return s.clearCache, nil
}

// InitSchemaSQL returns the full schema initialization SQL.
// Returns an error if schema loading fails.
func InitSchemaSQL() (string, error) {
	schema, err := loadSchema()
	if err != nil {
		return "", fmt.Errorf("failed to load schema: %w", err)
	}

	clearSQL, err := getClearCacheSQL()
	if err != nil {
		return "", err
	}

	var sb strings.Builder

	// Generate CREATE TABLE statements
	for tableName, table := range schema.Tables {
		sb.WriteString(table.generateCreateTableSQL(tableName))
		sb.WriteString(";\n")
	}

	// Clear existing data
	sb.WriteString(clearSQL)

	return sb.String(), nil
}

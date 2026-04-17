// Package duck provides common DuckDB utilities.
package duck

import (
	"database/sql"
	"fmt"

	_ "github.com/duckdb/duckdb-go/v2"
)

// Open opens a DuckDB connection.
// Note: DuckDB requires per-connection initialization (LOAD extensions, ATTACH databases).
// The caller is responsible for ensuring extensions are loaded on each connection if needed.
// For abrg, extensions are loaded at cache initialization time and the connection is reused.
func Open(path string) (*sql.DB, error) {
	return sql.Open("duckdb", path)
}

// LoadExtension installs and loads a DuckDB extension.
func LoadExtension(db *sql.DB, name string) error {
	_, err := db.Exec(fmt.Sprintf("INSTALL %s; LOAD %s", name, name))
	return err
}

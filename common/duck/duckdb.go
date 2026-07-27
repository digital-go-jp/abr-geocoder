// Package duck provides common DuckDB utilities.
package duck

import (
	"context"
	"database/sql"
	"fmt"

	_ "github.com/duckdb/duckdb-go/v2"
)

// Open opens a DuckDB connection pool.
// Extension loading (LOAD) and options such as threads act on the shared
// database instance, not on individual connections: issuing them once through
// the pool makes them visible to every present and future pooled connection.
func Open(path string) (*sql.DB, error) {
	return sql.Open("duckdb", path)
}

// LoadExtension installs and loads a DuckDB extension.
func LoadExtension(ctx context.Context, db *sql.DB, name string) error {
	_, err := db.ExecContext(ctx, fmt.Sprintf("INSTALL %s; LOAD %s", name, name))
	return err
}

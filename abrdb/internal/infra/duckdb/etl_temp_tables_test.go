package duckdb

import (
	"testing"

	"abr.local/common/duck"
)

// TestTempTablesAreConnectionLocal pins the DuckDB semantics LoadData relies
// on: a TEMP table belongs to the connection that created it, so a DROP issued
// on a different connection silently misses it. This is why LoadData pins one
// sql.Conn for the whole load including the deferred cleanup.
func TestTempTablesAreConnectionLocal(t *testing.T) {
	d, err := duck.Open("")
	if err != nil {
		t.Fatalf("open duckdb: %v", err)
	}
	defer func() { _ = d.Close() }()
	d.SetMaxOpenConns(2)
	ctx := t.Context()

	conn1, err := d.Conn(ctx)
	if err != nil {
		t.Fatalf("conn1: %v", err)
	}
	defer func() { _ = conn1.Close() }()
	conn2, err := d.Conn(ctx)
	if err != nil {
		t.Fatalf("conn2: %v", err)
	}
	defer func() { _ = conn2.Close() }()

	if _, err := conn1.ExecContext(ctx, "CREATE TEMP TABLE t_local (i INTEGER)"); err != nil {
		t.Fatalf("create temp table: %v", err)
	}

	// The drop on the other connection succeeds as a no-op.
	if _, err := conn2.ExecContext(ctx, "DROP TABLE IF EXISTS t_local"); err != nil {
		t.Fatalf("drop on other connection: %v", err)
	}
	var n int
	if err := conn1.QueryRowContext(ctx, "SELECT count(*) FROM t_local").Scan(&n); err != nil {
		t.Errorf("temp table vanished after a foreign-connection drop: %v", err)
	}
}

// TestCleanupTempTables_DropsOnSameConnection verifies that cleanup removes
// every table LoadData creates when run on the creating connection.
func TestCleanupTempTables_DropsOnSameConnection(t *testing.T) {
	d, err := duck.Open("")
	if err != nil {
		t.Fatalf("open duckdb: %v", err)
	}
	defer func() { _ = d.Close() }()
	ctx := t.Context()

	conn, err := d.Conn(ctx)
	if err != nil {
		t.Fatalf("conn: %v", err)
	}
	defer func() { _ = conn.Close() }()

	const suffix = "_cleanup_test"
	tn := generateTableNames(suffix)
	for _, table := range []string{tn.Text, tn.Pos, tn.Transformed} {
		if _, err := conn.ExecContext(ctx, "CREATE TEMP TABLE "+table+" (i INTEGER)"); err != nil {
			t.Fatalf("create %s: %v", table, err)
		}
	}

	cleanupTempTables(ctx, conn, tn)

	for _, table := range []string{tn.Text, tn.Pos, tn.Transformed} {
		var n int
		if err := conn.QueryRowContext(ctx, "SELECT count(*) FROM "+table).Scan(&n); err == nil {
			t.Errorf("table %s still exists after cleanup", table)
		}
	}
}

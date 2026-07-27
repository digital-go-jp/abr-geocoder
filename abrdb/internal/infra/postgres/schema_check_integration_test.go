package postgres

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"abrdb/internal/infra/db"
)

// newIntegrationExecutor connects to the PostgreSQL configured via the DB_*
// environment variables. An unreachable database skips the test so runs
// without a database stay green; ABRDB_TEST_REQUIRE_DB=1 turns the skip into
// a failure for environments that guarantee a database.
func newIntegrationExecutor(t *testing.T) *db.QueryExecutor {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	qe, err := db.NewQueryExecutorFromEnv(ctx)
	if err != nil {
		if os.Getenv("ABRDB_TEST_REQUIRE_DB") != "" {
			t.Fatalf("ABRDB_TEST_REQUIRE_DB is set but PostgreSQL is not reachable: %v", err)
		}
		t.Skipf("Skipping integration test: PostgreSQL not reachable: %v", err)
	}
	t.Cleanup(func() { _ = qe.Close() })
	return qe
}

// TestVerifyTableColumnsIntegration exercises the information_schema query
// against a real server with a uniquely named scratch table.
func TestVerifyTableColumnsIntegration(t *testing.T) {
	qe := newIntegrationExecutor(t)
	ctx := t.Context()

	table := fmt.Sprintf("abrdb_test_verify_columns_%d", os.Getpid())
	if err := qe.Exec(ctx, fmt.Sprintf("CREATE TABLE %s (lg_code CHAR(6) NOT NULL, pref TEXT)", table)); err != nil {
		t.Fatalf("create scratch table: %v", err)
	}
	t.Cleanup(func() {
		// t.Context() is cancelled by the time cleanups run.
		_ = qe.Exec(context.Background(), fmt.Sprintf("DROP TABLE IF EXISTS %s", table))
	})

	t.Run("matching columns pass", func(t *testing.T) {
		if err := VerifyTableColumns(ctx, qe, map[string][]string{table: {"lg_code", "pref"}}); err != nil {
			t.Errorf("VerifyTableColumns() = %v, want nil", err)
		}
	})

	t.Run("missing column is reported", func(t *testing.T) {
		err := VerifyTableColumns(ctx, qe, map[string][]string{table: {"lg_code", "pref", "pref_kana"}})
		if err == nil {
			t.Fatal("VerifyTableColumns() = nil, want error")
		}
		for _, want := range []string{table, "pref_kana", "abrdb init"} {
			if !strings.Contains(err.Error(), want) {
				t.Errorf("error %q does not mention %q", err, want)
			}
		}
	})

	t.Run("missing table is reported", func(t *testing.T) {
		err := VerifyTableColumns(ctx, qe, map[string][]string{table + "_absent": {"lg_code"}})
		if err == nil {
			t.Fatal("VerifyTableColumns() = nil, want error")
		}
		if !strings.Contains(err.Error(), table+"_absent is missing") {
			t.Errorf("error %q does not report the missing table", err)
		}
	})
}

package db

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"
)

// newIntegrationExecutor connects to the PostgreSQL configured via the DB_*
// environment variables. An unreachable database skips the test so runs
// without a database stay green; ABRDB_TEST_REQUIRE_DB=1 turns the skip into
// a failure for environments that guarantee a database, such as the dedicated
// CI job. Locally the tests run against the devcontainer database
// (DB_HOST=host.docker.internal, credentials from abrdb/.env).
func newIntegrationExecutor(t *testing.T) *QueryExecutor {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	qe, err := NewQueryExecutorFromEnv(ctx)
	if err != nil {
		if os.Getenv("ABRDB_TEST_REQUIRE_DB") != "" {
			t.Fatalf("ABRDB_TEST_REQUIRE_DB is set but PostgreSQL is not reachable: %v", err)
		}
		t.Skipf("Skipping integration test: PostgreSQL not reachable: %v", err)
	}
	t.Cleanup(func() { _ = qe.Close() })
	return qe
}

// TestImportLockIntegration_AcquireContendRelease pins the DB-23 core against
// a real server: acquisition on a dedicated session, immediate failure of a
// contending acquisition, protection against idle_session_timeout, and
// re-acquisition after release.
func TestImportLockIntegration_AcquireContendRelease(t *testing.T) {
	qe := newIntegrationExecutor(t)
	ctx := t.Context()

	lock, err := qe.AcquireImportLock(ctx)
	if err != nil {
		t.Fatalf("first AcquireImportLock: %v", err)
	}

	// A contending acquisition uses a different pooled connection, so the
	// session-level lock must reject it immediately with the dedicated error.
	start := time.Now()
	if _, err := qe.AcquireImportLock(ctx); !errors.Is(err, ErrImportLocked) {
		lock.Release(ctx)
		t.Fatalf("second AcquireImportLock: err = %v, want ErrImportLocked", err)
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("contending acquisition took %v, want immediate failure", elapsed)
	}

	// The lock session disables idle_session_timeout so the server cannot
	// kill it mid-import. current_setting with missing_ok covers servers
	// older than 14, where the GUC does not exist and the check is moot.
	var timeoutSetting *string
	if err := lock.conn.QueryRow(ctx, "SELECT current_setting('idle_session_timeout', true)").Scan(&timeoutSetting); err != nil {
		t.Errorf("read idle_session_timeout: %v", err)
	} else if timeoutSetting != nil && *timeoutSetting != "" && *timeoutSetting != "0" {
		t.Errorf("idle_session_timeout = %q on the lock session, want 0", *timeoutSetting)
	}

	lock.Release(ctx)

	relock, err := qe.AcquireImportLock(ctx)
	if err != nil {
		t.Fatalf("re-acquire after release: %v", err)
	}
	relock.Release(ctx)
}

// TestImportLockIntegration_ReleaseWithCanceledContext pins the error-path
// cleanup: the deferred Release after a SIGTERM runs with an already-canceled
// context and must still free the lock, either by unlocking or by closing the
// session.
func TestImportLockIntegration_ReleaseWithCanceledContext(t *testing.T) {
	qe := newIntegrationExecutor(t)
	ctx := t.Context()

	lock, err := qe.AcquireImportLock(ctx)
	if err != nil {
		t.Fatalf("AcquireImportLock: %v", err)
	}

	canceled, cancel := context.WithCancel(ctx)
	cancel()
	lock.Release(canceled)

	relock, err := qe.AcquireImportLock(ctx)
	if err != nil {
		t.Fatalf("re-acquire after canceled-context release: %v", err)
	}
	relock.Release(ctx)
}

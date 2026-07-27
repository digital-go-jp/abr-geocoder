package db

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Advisory lock key for the import pipeline, passed as the two int32 halves of
// pg_try_advisory_lock(int32, int32). Fixed constants so every abrdb build
// contends on the same database-wide lock.
const (
	importLockClassID int32 = 0x61627264 // "abrd"
	importLockObjID   int32 = 1
)

// ErrImportLocked reports that another import process holds the advisory lock.
var ErrImportLocked = errors.New("another abrdb import is already running: retry after it finishes")

// ImportLock is a session-scoped PostgreSQL advisory lock held on a dedicated
// pooled connection. The connection stays checked out of the pool for the
// whole import (through the post-import ANALYZE): a session lock lives on its
// connection, so releasing the connection early would drop or orphan the lock.
type ImportLock struct {
	conn *pgxpool.Conn
}

// AcquireImportLock takes the import advisory lock without waiting.
// It returns ErrImportLocked when another session holds the lock.
func (q *QueryExecutor) AcquireImportLock(ctx context.Context) (*ImportLock, error) {
	conn, err := q.pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("acquire connection for import lock: %w", err)
	}

	var locked bool
	err = conn.QueryRow(ctx, "SELECT pg_try_advisory_lock($1, $2)", importLockClassID, importLockObjID).Scan(&locked)
	if err != nil {
		conn.Release()
		return nil, fmt.Errorf("acquire import lock: %w", err)
	}
	if !locked {
		conn.Release()
		return nil, ErrImportLocked
	}

	// This session sits idle while the import runs on other connections. With
	// idle_session_timeout set, the server would kill the session and
	// silently release the advisory lock, letting a second import in. The
	// error is ignored on purpose: the GUC exists from PostgreSQL 14, and on
	// older servers - where the SET fails as an unrecognized parameter - no
	// idle timeout can cut the session either.
	_, _ = conn.Exec(ctx, "SET idle_session_timeout = 0")

	return &ImportLock{conn: conn}, nil
}

// Release unlocks and returns the connection to the pool. The unlock runs
// independently of the caller's cancellation but with its own short deadline,
// so a SIGTERM or workflow timeout cannot leave the CLI hanging on an
// unresponsive server. If the unlock fails, the connection is closed instead
// and pgxpool discards it on Release; ending the session makes the server
// release the advisory lock with it.
func (l *ImportLock) Release(ctx context.Context) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()

	if _, err := l.conn.Exec(ctx, "SELECT pg_advisory_unlock($1, $2)", importLockClassID, importLockObjID); err != nil {
		_ = l.conn.Conn().Close(ctx)
	}
	l.conn.Release()
}

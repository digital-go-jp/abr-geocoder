package db

import (
	"context"
	"errors"
	"fmt"

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
	return &ImportLock{conn: conn}, nil
}

// Release unlocks and returns the connection to the pool. If the unlock query
// fails, the connection is closed instead, which drops the session lock with it.
func (l *ImportLock) Release(ctx context.Context) {
	if _, err := l.conn.Exec(ctx, "SELECT pg_advisory_unlock($1, $2)", importLockClassID, importLockObjID); err != nil {
		_ = l.conn.Conn().Close(ctx)
	}
	l.conn.Release()
}

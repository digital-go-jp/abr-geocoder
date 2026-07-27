package postgres

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// fakeTx implements the pgx.Tx methods RunMigrations touches; the embedded
// interface panics on anything else.
type fakeTx struct {
	pgx.Tx
	execErrOn  int // 1-based Exec call number that fails; 0 = never
	execCalls  int
	execSQL    []string
	commitErr  error
	committed  bool
	rolledBack bool
}

func (t *fakeTx) Exec(_ context.Context, sql string, _ ...any) (pgconn.CommandTag, error) {
	t.execCalls++
	t.execSQL = append(t.execSQL, sql)
	if t.execErrOn != 0 && t.execCalls == t.execErrOn {
		return pgconn.CommandTag{}, errors.New("exec boom")
	}
	return pgconn.CommandTag{}, nil
}

func (t *fakeTx) Commit(context.Context) error {
	if t.commitErr != nil {
		return t.commitErr
	}
	t.committed = true
	return nil
}

func (t *fakeTx) Rollback(context.Context) error {
	t.rolledBack = true
	return nil
}

// fakeBeginner implements txBeginner.
type fakeBeginner struct {
	beginErr error
	tx       *fakeTx
}

func (b *fakeBeginner) Begin(context.Context) (pgx.Tx, error) {
	if b.beginErr != nil {
		return nil, b.beginErr
	}
	return b.tx, nil
}

// migrationFileCount is the number of embedded migrations/*.sql files each
// run executes before the optional DDL statement.
const migrationFileCount = 2

func TestRunMigrations_Success(t *testing.T) {
	tx := &fakeTx{}
	m := NewMigrator(&fakeBeginner{tx: tx}, "CREATE TABLE ddl_from_config ()")

	if err := m.RunMigrations(context.Background()); err != nil {
		t.Fatalf("RunMigrations() = %v, want nil", err)
	}
	if tx.execCalls != migrationFileCount+1 {
		t.Errorf("Exec calls = %d, want %d (migration files + config DDL)", tx.execCalls, migrationFileCount+1)
	}
	if last := tx.execSQL[len(tx.execSQL)-1]; !strings.Contains(last, "ddl_from_config") {
		t.Errorf("last Exec = %q, want the config DDL", last)
	}
	if !tx.committed {
		t.Error("Commit was not called")
	}
	if tx.rolledBack {
		t.Error("Rollback was called after a successful commit")
	}
}

func TestRunMigrations_BeginError(t *testing.T) {
	beginErr := errors.New("begin boom")
	m := NewMigrator(&fakeBeginner{beginErr: beginErr}, "")

	err := m.RunMigrations(context.Background())
	if !errors.Is(err, beginErr) {
		t.Errorf("RunMigrations() = %v, want wrapped %v", err, beginErr)
	}
}

func TestRunMigrations_ExecErrorRollsBack(t *testing.T) {
	tests := []struct {
		name      string
		execErrOn int
		ddl       string
	}{
		{name: "migration file exec fails", execErrOn: 1, ddl: ""},
		{name: "config DDL exec fails", execErrOn: migrationFileCount + 1, ddl: "CREATE TABLE ddl_from_config ()"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := &fakeTx{execErrOn: tt.execErrOn}
			m := NewMigrator(&fakeBeginner{tx: tx}, tt.ddl)

			err := m.RunMigrations(context.Background())
			if err == nil || !strings.Contains(err.Error(), "exec boom") {
				t.Errorf("RunMigrations() = %v, want wrapped exec error", err)
			}
			if tx.committed {
				t.Error("Commit was called despite an Exec failure")
			}
			if !tx.rolledBack {
				t.Error("Rollback was not called after an Exec failure")
			}
		})
	}
}

func TestRunMigrations_CommitErrorRollsBack(t *testing.T) {
	commitErr := errors.New("commit boom")
	tx := &fakeTx{commitErr: commitErr}
	m := NewMigrator(&fakeBeginner{tx: tx}, "")

	err := m.RunMigrations(context.Background())
	if !errors.Is(err, commitErr) {
		t.Errorf("RunMigrations() = %v, want wrapped %v", err, commitErr)
	}
	if !tx.rolledBack {
		t.Error("Rollback was not called after a Commit failure")
	}
}

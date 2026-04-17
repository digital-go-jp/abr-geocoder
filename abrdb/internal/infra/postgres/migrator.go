package postgres

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"path/filepath"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

type Migrator struct {
	pool      *pgxpool.Pool
	ddlSource string // DDL for data tables (generated from YAML config)
}

func NewMigrator(pool *pgxpool.Pool, ddlSource string) *Migrator {
	return &Migrator{pool: pool, ddlSource: ddlSource}
}

// RunMigrations executes all SQL migration files and DDL from config.
func (m *Migrator) RunMigrations(ctx context.Context) error {
	entries, err := migrationFiles.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations directory: %w", err)
	}

	// Sort files by name
	var filenames []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".sql") {
			filenames = append(filenames, entry.Name())
		}
	}
	slices.Sort(filenames)

	// Execute migrations in transaction
	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	slog.Debug("running migrations", "event", "migrate", "file_count", len(filenames))

	// Execute embedded migration files
	for _, filename := range filenames {
		if err := m.executeMigration(ctx, tx, filename); err != nil {
			return fmt.Errorf("execute migration %s: %w", filename, err)
		}
	}

	// Execute DDL from YAML config (data tables)
	if m.ddlSource != "" {
		if _, err := tx.Exec(ctx, m.ddlSource); err != nil {
			return fmt.Errorf("execute DDL from config: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	committed = true

	slog.Debug("migrations completed", "event", "migrate")
	return nil
}

func (m *Migrator) executeMigration(ctx context.Context, tx pgx.Tx, filename string) error {
	content, err := fs.ReadFile(migrationFiles, filepath.Join("migrations", filename))
	if err != nil {
		return fmt.Errorf("read file: %w", err)
	}

	query := strings.TrimSpace(string(content))
	if query == "" {
		return nil
	}

	_, err = tx.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("exec: %w", err)
	}
	return nil
}

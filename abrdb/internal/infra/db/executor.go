// Package db provides PostgreSQL access utilities for abrdb.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	commondb "abr.local/common/db"
)

// QueryExecutor handles database query execution using pgxpool.
type QueryExecutor struct {
	pool *pgxpool.Pool
}

// NewQueryExecutor creates a new query executor with pgxpool.
func NewQueryExecutor(ctx context.Context, connStr string) (*QueryExecutor, error) {
	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("parse pool config: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// Health check. The first connection may have to wait for a database that
	// is paused or still starting up.
	pingCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &QueryExecutor{pool: pool}, nil
}

// Pool returns the underlying pgxpool.Pool for direct access.
func (q *QueryExecutor) Pool() *pgxpool.Pool {
	return q.pool
}

// Query executes a query that returns rows.
func (q *QueryExecutor) Query(ctx context.Context, query string, args ...any) (pgx.Rows, error) {
	return q.pool.Query(ctx, query, args...)
}

// Exec executes a query that does not return rows.
func (q *QueryExecutor) Exec(ctx context.Context, query string, args ...any) error {
	_, err := q.pool.Exec(ctx, query, args...)
	return err
}

// QueryRow executes a query that returns at most one row.
func (q *QueryExecutor) QueryRow(ctx context.Context, query string, args ...any) pgx.Row {
	return q.pool.QueryRow(ctx, query, args...)
}

// Close closes the connection pool.
func (q *QueryExecutor) Close() error {
	if q.pool != nil {
		q.pool.Close()
	}
	return nil
}

// NewQueryExecutorFromEnv creates a new query executor using environment variables.
func NewQueryExecutorFromEnv(ctx context.Context) (*QueryExecutor, error) {
	cfg := commondb.LoadDBConfigFromEnv()
	return NewQueryExecutor(ctx, cfg.DSN())
}

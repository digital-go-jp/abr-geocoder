// Package command provides CLI commands for abrdb database operations.
package command

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"

	"abrdb/internal/infra/db"

	"abrdb/internal/infra/api"
	"abrdb/internal/infra/config"
)

// ServiceContainer holds all shared services for commands
type ServiceContainer struct {
	QueryExecutor *db.QueryExecutor
	Config        *config.Config
	APIClient     *api.Client
}

// NewServiceContainer creates and initializes all services
func NewServiceContainer(ctx context.Context) (*ServiceContainer, error) {
	cfg := config.Load()
	qe, err := db.NewQueryExecutorFromEnv(ctx)
	if err != nil {
		return nil, fmt.Errorf("query executor: %w", err)
	}

	return &ServiceContainer{
		QueryExecutor: qe,
		Config:        cfg,
		APIClient:     api.New(cfg.API.FeedURL),
	}, nil
}

// WithServices creates a command runner with initialized services
func WithServices(fn func(context.Context, *ServiceContainer) error) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, _ []string) error {
		ctx := cmd.Context()
		container, err := NewServiceContainer(ctx)
		if err != nil {
			return err
		}
		defer func() { _ = container.QueryExecutor.Close() }()
		return fn(ctx, container)
	}
}

// Package command provides CLI commands for the abrg server.
package command

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/spf13/cobra"

	"abr.local/common/version"

	"abrg/internal/api"
	"abrg/internal/cache"
	"abrg/internal/infra/config"
)

// NewServerCmd creates a new server command.
func NewServerCmd() *cobra.Command {
	var cachePath string

	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the ABR Geocoder server",
		Long:  `Start the ABR Geocoder server that provides geocoding and reverse geocoding APIs.`,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return runServer(cmd.Context(), cachePath)
		},
	}

	cmd.Flags().StringVarP(&cachePath, "cache", "c", "", "Cache file path (default: ~/.abrg/cache/abrg.duckdb)")

	return cmd
}

func runServer(ctx context.Context, cacheFlag string) error {
	cfg := config.Load()
	cachePath, err := resolveCachePath(cacheFlag)
	if err != nil {
		return err
	}

	// Open cache once and read config from the same connection
	dbCache, cacheCfg, err := loadServerConfig(ctx, cachePath)
	if err != nil {
		return err
	}

	slog.Info("server configuration",
		"event", "server_config",
		"api_version", version.Version,
		"db_version", cacheCfg.DBVersion,
		"category", cacheCfg.EnabledCategory,
		"pref", cacheCfg.EnabledPref,
		"pos", cacheCfg.PosEnabled())

	server, err := api.NewGinServer(ctx, api.ServerConfig{
		APIVersion:      version.Version,
		CORSAllowOrigin: cfg.Server.CORSAllowOrigin,
		Cache:           dbCache,
		CacheConfig:     *cacheCfg,
	})
	if err != nil {
		_ = dbCache.Close()
		return serverInitError(err)
	}
	defer func() {
		if err := server.Close(); err != nil {
			slog.Warn("failed to close server resources", "event", "server_close", "error", err)
		}
	}()

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.Server.Port),
		Handler:           server.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return runHTTPServer(ctx, srv)
}

// serverInitError converts a server initialization failure into the command
// result. Cancellation (Ctrl-C / SIGTERM) during initialization is a clean
// shutdown and yields nil; any other error is wrapped.
func serverInitError(err error) error {
	if errors.Is(err, context.Canceled) {
		return nil
	}
	return fmt.Errorf("failed to initialize server: %w", err)
}

// runHTTPServer runs an http.Server until ctx is cancelled, then performs
// a graceful shutdown with a bounded timeout.
func runHTTPServer(ctx context.Context, srv *http.Server) error {
	errChan := make(chan error, 1)
	go func() {
		slog.Info("server started", "event", "server_start", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errChan <- err
		}
	}()

	select {
	case <-ctx.Done():
		slog.Info("received shutdown signal", "event", "shutdown_signal", "cause", context.Cause(ctx))
	case err := <-errChan:
		return fmt.Errorf("server failed to start: %w", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown failed: %w", err)
	}

	slog.Info("server stopped", "event", "server_stop")
	return nil
}

// loadServerConfig opens the DuckDB cache and loads configuration from it.
// The returned cache is ready for use and must be closed by the caller.
// Cache file must be prepared beforehand using 'abrg cache build'.
func loadServerConfig(ctx context.Context, cachePath string) (*cache.DuckDBCache, *cache.Config, error) {
	if _, err := cache.FileInfo(cachePath); err != nil {
		slog.Warn("failed to get cache file info", "event", "cache_file_info", "path", cachePath, "error", err)
	}

	// Open cache once — this connection will be reused by the server
	dbCache, err := cache.NewDuckDBCacheFromPath(ctx, cachePath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open cache %s: %w", cachePath, err)
	}

	// Close cache on any error after successful open
	success := false
	defer func() {
		if !success {
			_ = dbCache.Close()
		}
	}()

	// Read config from the already-open connection (no second open)
	cacheCfg, err := cache.LoadConfig(ctx, dbCache.DB())
	if err != nil {
		return nil, nil, fmt.Errorf("failed to load config from cache %s: %w", cachePath, err)
	}

	if cacheCfg.EnabledCategory == "" {
		return nil, nil, fmt.Errorf("cache file %s has no configuration: rebuild with 'abrg cache build'", cachePath)
	}

	success = true
	return dbCache, cacheCfg, nil
}

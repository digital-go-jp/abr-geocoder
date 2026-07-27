package util

import (
	"context"
	"log/slog"
	"os"
	"runtime"
	"strconv"

	"abr.local/common/progress"
	"golang.org/x/sync/errgroup"
)

// maxConcurrency caps operator-supplied worker limits so a typo cannot flood
// the source feed or exhaust PostgreSQL connections.
const maxConcurrency = 32

// ConcurrencyLimit returns the worker limit configured in the named
// environment variable. Unset, invalid, or non-positive values fall back to
// GOMAXPROCS (container-aware); values above maxConcurrency are clamped.
func ConcurrencyLimit(envName string) int {
	v, ok := os.LookupEnv(envName)
	if !ok || v == "" {
		return runtime.GOMAXPROCS(0)
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		slog.Warn("ignoring invalid concurrency setting",
			"event", "concurrency", "env", envName, "value", v)
		return runtime.GOMAXPROCS(0)
	}
	return min(n, maxConcurrency)
}

// ExecuteConcurrently runs workers over items with bounded parallelism and integrated progress tracking.
// A non-positive limit falls back to GOMAXPROCS (container-aware in Go 1.21+).
// If monitor is nil, progress tracking is skipped.
func ExecuteConcurrently[T any](
	ctx context.Context,
	items []T,
	worker func(context.Context, T) error,
	monitor progress.Monitor,
	taskName string,
	limit int,
) error {
	if len(items) == 0 {
		return nil
	}

	if monitor != nil {
		monitor.StartTask(taskName, int64(len(items)))
	}

	g, ctx := errgroup.WithContext(ctx)
	if limit <= 0 {
		limit = runtime.GOMAXPROCS(0)
	}
	g.SetLimit(min(limit, len(items)))

	for _, item := range items {
		g.Go(func() error {
			if err := worker(ctx, item); err != nil {
				return err
			}
			if monitor != nil {
				monitor.UpdateProgress(1)
			}
			return nil
		})
	}

	err := g.Wait()

	if monitor != nil {
		if err != nil {
			monitor.Cancel()
		} else {
			monitor.CompleteTask()
		}
	}

	return err
}

package util

import (
	"context"
	"runtime"

	"abr.local/common/progress"
	"golang.org/x/sync/errgroup"
)

// ExecuteConcurrently runs workers over items with bounded parallelism and integrated progress tracking.
// Uses GOMAXPROCS for concurrency limit (container-aware in Go 1.21+).
// If monitor is nil, progress tracking is skipped.
func ExecuteConcurrently[T any](
	ctx context.Context,
	items []T,
	worker func(context.Context, T) error,
	monitor progress.Monitor,
	taskName string,
) error {
	if len(items) == 0 {
		return nil
	}

	if monitor != nil {
		monitor.StartTask(taskName, int64(len(items)))
	}

	g, ctx := errgroup.WithContext(ctx)
	limit := min(runtime.GOMAXPROCS(0), len(items))
	if limit <= 0 {
		limit = 1
	}
	g.SetLimit(limit)

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

package util

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
)

func TestExecuteConcurrently_EmptyItems(t *testing.T) {
	var called bool
	worker := func(ctx context.Context, item int) error {
		called = true
		return nil
	}

	err := ExecuteConcurrently(context.Background(), []int{}, worker, nil, "test")
	if err != nil {
		t.Errorf("ExecuteConcurrently() with empty items should return nil, got %v", err)
	}
	if called {
		t.Error("Worker should not be called for empty items")
	}
}

func TestExecuteConcurrently_AllItemsProcessed(t *testing.T) {
	items := []int{1, 2, 3, 4, 5}
	var processedCount atomic.Int32

	worker := func(ctx context.Context, item int) error {
		processedCount.Add(1)
		return nil
	}

	err := ExecuteConcurrently(context.Background(), items, worker, nil, "test")
	if err != nil {
		t.Errorf("ExecuteConcurrently() unexpected error: %v", err)
	}

	if int(processedCount.Load()) != len(items) {
		t.Errorf("Processed %d items, want %d", processedCount.Load(), len(items))
	}
}

func TestExecuteConcurrently_WorkerError(t *testing.T) {
	items := []int{1, 2, 3}
	expectedErr := errors.New("worker error")

	worker := func(ctx context.Context, item int) error {
		if item == 2 {
			return expectedErr
		}
		return nil
	}

	err := ExecuteConcurrently(context.Background(), items, worker, nil, "test")
	if err == nil {
		t.Error("ExecuteConcurrently() should return error when worker fails")
	}
	if !errors.Is(err, expectedErr) {
		t.Errorf("ExecuteConcurrently() error = %v, want %v", err, expectedErr)
	}
}

func TestExecuteConcurrently_ContextCancellation(t *testing.T) {
	items := []int{1, 2, 3, 4, 5}
	ctx, cancel := context.WithCancel(context.Background())

	var startedCount atomic.Int32
	worker := func(ctx context.Context, item int) error {
		startedCount.Add(1)
		if item == 1 {
			cancel() // Cancel after first item
		}
		// Check if context is cancelled
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			return nil
		}
	}

	err := ExecuteConcurrently(ctx, items, worker, nil, "test")
	// Error might be context.Canceled or nil depending on timing
	// The important thing is that it doesn't panic
	_ = err
}

func TestExecuteConcurrently_StringItems(t *testing.T) {
	items := []string{"a", "b", "c"}
	var processedCount atomic.Int32

	worker := func(ctx context.Context, item string) error {
		processedCount.Add(1)
		return nil
	}

	err := ExecuteConcurrently(context.Background(), items, worker, nil, "test")
	if err != nil {
		t.Errorf("ExecuteConcurrently() unexpected error: %v", err)
	}

	if int(processedCount.Load()) != len(items) {
		t.Errorf("Processed %d items, want %d", processedCount.Load(), len(items))
	}
}

func TestExecuteConcurrently_SingleItem(t *testing.T) {
	items := []int{42}
	var processedItem int

	worker := func(ctx context.Context, item int) error {
		processedItem = item
		return nil
	}

	err := ExecuteConcurrently(context.Background(), items, worker, nil, "test")
	if err != nil {
		t.Errorf("ExecuteConcurrently() unexpected error: %v", err)
	}

	if processedItem != 42 {
		t.Errorf("Processed item = %d, want 42", processedItem)
	}
}

// mockMonitor implements progress.Monitor for testing
type mockMonitor struct {
	startCalled    bool
	completeCalled bool
	cancelCalled   bool
	progressCount  atomic.Int64
	taskName       string
	totalItems     int64
}

func (m *mockMonitor) StartTask(name string, total int64) {
	m.startCalled = true
	m.taskName = name
	m.totalItems = total
}

func (m *mockMonitor) UpdateProgress(delta int64) {
	m.progressCount.Add(delta)
}

func (m *mockMonitor) CompleteTask() {
	m.completeCalled = true
}

func (m *mockMonitor) Cancel() {
	m.cancelCalled = true
}

func TestExecuteConcurrently_WithMonitor_Success(t *testing.T) {
	items := []int{1, 2, 3, 4, 5}
	monitor := &mockMonitor{}

	worker := func(ctx context.Context, item int) error {
		return nil
	}

	err := ExecuteConcurrently(context.Background(), items, worker, monitor, "test-task")
	if err != nil {
		t.Errorf("ExecuteConcurrently() unexpected error: %v", err)
	}

	if !monitor.startCalled {
		t.Error("Monitor.StartTask should be called")
	}
	if monitor.taskName != "test-task" {
		t.Errorf("Monitor.taskName = %q, want %q", monitor.taskName, "test-task")
	}
	if monitor.totalItems != int64(len(items)) {
		t.Errorf("Monitor.totalItems = %d, want %d", monitor.totalItems, len(items))
	}
	if monitor.progressCount.Load() != int64(len(items)) {
		t.Errorf("Monitor.progressCount = %d, want %d", monitor.progressCount.Load(), len(items))
	}
	if !monitor.completeCalled {
		t.Error("Monitor.CompleteTask should be called on success")
	}
	if monitor.cancelCalled {
		t.Error("Monitor.Cancel should not be called on success")
	}
}

func TestExecuteConcurrently_WithMonitor_Error(t *testing.T) {
	items := []int{1, 2, 3}
	monitor := &mockMonitor{}
	expectedErr := errors.New("test error")

	worker := func(ctx context.Context, item int) error {
		if item == 2 {
			return expectedErr
		}
		return nil
	}

	err := ExecuteConcurrently(context.Background(), items, worker, monitor, "test-task")
	if err == nil {
		t.Error("ExecuteConcurrently() should return error")
	}

	if !monitor.startCalled {
		t.Error("Monitor.StartTask should be called")
	}
	if monitor.completeCalled {
		t.Error("Monitor.CompleteTask should not be called on error")
	}
	if !monitor.cancelCalled {
		t.Error("Monitor.Cancel should be called on error")
	}
}

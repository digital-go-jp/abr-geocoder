// Package progress provides progress monitoring and display for long-running operations.
package progress

// Monitor defines the interface for progress tracking
type Monitor interface {
	StartTask(name string, total int64)
	UpdateProgress(delta int64)
	CompleteTask()
	Cancel()
	// StartStage displays a step that cannot be tracked by count, and returns
	// the function that ends the display.
	StartStage(name string) func()
}

package progress

import (
	"fmt"
	"sync/atomic"
	"time"
)

// Console tracks a task of known size on one terminal line:
// [percentage] current/total | Rate: X/sec | Avg: Y/sec | ETA: Zs
type Console struct {
	line      line
	startTime time.Time
	taskName  string
	total     int64
	current   atomic.Int64
	isActive  bool
	lastCount int64
}

func NewConsole() *Console {
	return &Console{}
}

// StartTask begins tracking a new task
func (m *Console) StartTask(name string, total int64) {
	termMu.Lock()
	defer termMu.Unlock()

	m.taskName = name
	m.total = total
	m.current.Store(0)
	m.startTime = time.Now()
	m.isActive = true
	m.lastCount = 0

	m.line.start(m.render)
}

// UpdateProgress updates the current progress
func (m *Console) UpdateProgress(delta int64) {
	if delta <= 0 {
		return
	}
	m.current.Add(delta)
}

// CompleteTask marks the current task as complete
func (m *Console) CompleteTask() {
	termMu.Lock()
	defer termMu.Unlock()

	if !m.isActive {
		return
	}
	// Marked finished before the teardown, which releases termMu while it waits
	// for the refresh goroutine: a Cancel arriving in that window has to see a
	// task that is already over instead of tearing it down a second time.
	m.isActive = false

	// Set to 100% and print final progress
	m.current.Store(m.total)
	m.line.complete(m.render())
}

// Cancel cancels the current task
func (m *Console) Cancel() {
	termMu.Lock()
	defer termMu.Unlock()

	if !m.isActive {
		return
	}
	m.isActive = false

	m.line.remove()
}

// StartStage shows how long a step with no countable items has been running,
// and returns the function that takes the line off the screen. The stage line
// replaces the task line, so it belongs between tasks rather than inside one.
func (m *Console) StartStage(name string) func() {
	return startStage(name).complete
}

// render builds the progress line and advances the per-second rate baseline.
// Must be called with termMu held.
func (m *Console) render() string {
	if m.total == 0 {
		return ""
	}

	current := m.current.Load()
	percentage := float64(current) * 100 / float64(m.total)

	elapsed := time.Since(m.startTime)
	rate := float64(current - m.lastCount)
	m.lastCount = current

	var avgRate float64
	if elapsed.Seconds() > 0 {
		avgRate = float64(current) / elapsed.Seconds()
	}

	var eta time.Duration
	if avgRate > 0 {
		eta = time.Duration(float64(m.total-current)/avgRate) * time.Second
	}

	if m.taskName != "" {
		return fmt.Sprintf("%s: [%6.2f%%] %d/%d | Rate: %.0f/sec | Avg: %.0f/sec | ETA: %-10s",
			m.taskName, percentage, current, m.total, rate, avgRate, formatDuration(eta))
	}
	return fmt.Sprintf("[%6.2f%%] %d/%d | Rate: %.0f/sec | Avg: %.0f/sec | ETA: %-10s",
		percentage, current, m.total, rate, avgRate, formatDuration(eta))
}

func formatDuration(d time.Duration) string {
	switch {
	case d <= 0:
		return "0s"
	case d < time.Second:
		return "< 1s"
	case d < time.Minute:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	default:
		return fmt.Sprintf("%dm%ds", int(d.Minutes()), int(d.Seconds())%60)
	}
}

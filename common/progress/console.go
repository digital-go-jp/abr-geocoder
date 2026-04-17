package progress

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// It shows: [percentage] current/total | Rate: X/sec | Avg: Y/sec | ETA: Zs
type Console struct {
	mu        sync.Mutex
	startTime time.Time
	taskName  string
	total     int64
	current   atomic.Int64
	isActive  bool
	lastWidth int
	lastCount int64

	stop chan struct{} // signals ticker to stop
	done chan struct{} // signals ticker has stopped
}

func NewConsole() *Console {
	return &Console{}
}

// StartTask begins tracking a new task
func (m *Console) StartTask(name string, total int64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.taskName = name
	m.total = total
	m.current.Store(0)
	m.startTime = time.Now()
	m.isActive = true
	m.lastWidth = 0
	m.lastCount = 0

	m.stop = make(chan struct{})
	m.done = make(chan struct{})

	// Print initial progress
	m.printProgress()

	// Start background ticker for periodic updates
	// Capture channels for goroutine to avoid race with stopTicker setting them to nil
	stop := m.stop
	done := m.done
	go m.tickerLoop(stop, done)
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
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.isActive {
		return
	}

	m.stopTicker()

	// Set to 100% and print final progress
	m.current.Store(m.total)
	m.printProgress()
	fmt.Fprintf(os.Stderr, "\n")
	m.isActive = false
	m.lastWidth = 0
}

// Cancel cancels the current task
func (m *Console) Cancel() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.isActive {
		return
	}

	m.stopTicker()

	// Clear the progress bar
	fmt.Fprintf(os.Stderr, "\r%s\r", strings.Repeat(" ", max(m.lastWidth, 1)))
	m.isActive = false
	m.lastWidth = 0
}

// stopTicker stops the background ticker goroutine.
// Must be called with m.mu held. Temporarily releases lock to avoid deadlock.
func (m *Console) stopTicker() {
	if m.stop == nil {
		return
	}
	stop := m.stop
	done := m.done
	m.stop = nil
	m.done = nil

	m.mu.Unlock()
	close(stop)
	<-done
	m.mu.Lock()
}

func (m *Console) tickerLoop(stop, done chan struct{}) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	defer close(done)

	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			m.mu.Lock()
			if m.isActive {
				m.printProgress()
			}
			m.mu.Unlock()
		}
	}
}

func (m *Console) printProgress() {
	if m.total == 0 {
		m.lastWidth = 0
		return
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

	prevWidth := m.lastWidth
	var content string
	if m.taskName != "" {
		content = fmt.Sprintf("%s: [%6.2f%%] %d/%d | Rate: %.0f/sec | Avg: %.0f/sec | ETA: %-10s",
			m.taskName, percentage, current, m.total, rate, avgRate, formatDuration(eta))
	} else {
		content = fmt.Sprintf("[%6.2f%%] %d/%d | Rate: %.0f/sec | Avg: %.0f/sec | ETA: %-10s",
			percentage, current, m.total, rate, avgRate, formatDuration(eta))
	}

	displayWidth := len(content)
	padding := max(prevWidth-displayWidth, 0)
	if padding > 0 {
		content += strings.Repeat(" ", padding)
	}

	fmt.Fprintf(os.Stderr, "\r%s", content)
	m.lastWidth = max(prevWidth, displayWidth)
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

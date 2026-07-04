package progress

import (
	"os"
	"sync"
	"testing"
	"time"
)

// silenceStderr redirects the package's os.Stderr writes to /dev/null for the
// duration of a test, since Console prints progress bars directly to stderr.
func silenceStderr(t *testing.T) {
	t.Helper()
	devnull, err := os.OpenFile(os.DevNull, os.O_WRONLY, 0)
	if err != nil {
		t.Fatalf("open devnull: %v", err)
	}
	orig := os.Stderr
	os.Stderr = devnull
	t.Cleanup(func() {
		os.Stderr = orig
		_ = devnull.Close()
	})
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		name string
		d    time.Duration
		want string
	}{
		{"zero", 0, "0s"},
		{"negative", -5 * time.Second, "0s"},
		{"sub-second", 500 * time.Millisecond, "< 1s"},
		{"exactly one second", time.Second, "1s"},
		{"seconds", 5 * time.Second, "5s"},
		{"just under a minute", 59 * time.Second, "59s"},
		{"exactly one minute", time.Minute, "1m0s"},
		{"minutes and seconds", 90 * time.Second, "1m30s"},
		{"over an hour stays in minutes", 3661 * time.Second, "61m1s"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := formatDuration(tt.d); got != tt.want {
				t.Errorf("formatDuration(%v) = %q, want %q", tt.d, got, tt.want)
			}
		})
	}
}

// TestConsole_ConcurrentUpdatesAccumulate runs with -race to prove UpdateProgress
// is safe to call from many goroutines while the ticker goroutine is live, and that
// every increment lands.
func TestConsole_ConcurrentUpdatesAccumulate(t *testing.T) {
	silenceStderr(t)

	const goroutines, perGoroutine = 8, 100
	c := NewConsole()
	c.StartTask("import", goroutines*perGoroutine)

	var wg sync.WaitGroup
	for range goroutines {
		wg.Go(func() {
			for range perGoroutine {
				c.UpdateProgress(1)
			}
		})
	}
	wg.Wait()

	if got := c.current.Load(); got != goroutines*perGoroutine {
		t.Errorf("current = %d, want %d", got, goroutines*perGoroutine)
	}
	c.CompleteTask()
}

// TestConsole_ConcurrentCancelIsRaceFree overlaps in-flight updates with Cancel and
// checks that lifecycle calls are idempotent (a second stop must be a no-op).
func TestConsole_ConcurrentCancelIsRaceFree(t *testing.T) {
	silenceStderr(t)

	c := NewConsole()
	c.StartTask("import", 1000)

	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			for range 100 {
				c.UpdateProgress(1)
			}
		})
	}

	c.Cancel()
	wg.Wait()

	// Idempotent: further lifecycle calls after Cancel must not panic or block.
	c.Cancel()
	c.CompleteTask()
}

func TestConsole_UpdateProgressIgnoresNonPositive(t *testing.T) {
	silenceStderr(t)

	c := NewConsole()
	c.StartTask("import", 10)
	c.UpdateProgress(5)
	c.UpdateProgress(0)
	c.UpdateProgress(-3)

	if got := c.current.Load(); got != 5 {
		t.Errorf("current = %d, want 5 (zero and negative deltas ignored)", got)
	}
	c.CompleteTask()
}

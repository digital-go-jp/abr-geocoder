package progress

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"testing"
)

// captureStderr replaces os.Stderr with a pipe and returns a function that
// closes it and yields everything written during the test.
func captureStderr(t *testing.T) func() string {
	t.Helper()
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("pipe: %v", err)
	}
	orig := os.Stderr
	os.Stderr = w

	var (
		once sync.Once
		out  string
	)
	read := func() string {
		once.Do(func() {
			os.Stderr = orig
			_ = w.Close()
			b, err := io.ReadAll(r)
			if err != nil {
				t.Errorf("read captured stderr: %v", err)
			}
			_ = r.Close()
			out = string(b)
		})
		return out
	}
	t.Cleanup(func() { read() })
	return read
}

func TestStderr_KeepsLogLineOffTheProgressLine(t *testing.T) {
	read := captureStderr(t)

	c := NewConsole()
	c.StartTask("import", 100)
	c.UpdateProgress(50)
	const logLine = "time=... level=DEBUG msg=\"etl step timing\"\n"
	_, _ = fmt.Fprint(Stderr, logLine)
	c.CompleteTask()

	got := read()
	before, after, found := strings.Cut(got, logLine)
	if !found {
		t.Fatalf("log line missing from stderr: %q", got)
	}
	if !strings.HasSuffix(before, eraseLine) {
		t.Errorf("log line was appended to the progress line: %q", before)
	}
	if !strings.HasPrefix(after, eraseLine+"import:") {
		t.Errorf("progress line was not redrawn after the log line: %q", after)
	}
}

func TestStderr_PassesThroughWithoutActiveTask(t *testing.T) {
	read := captureStderr(t)

	if _, err := fmt.Fprint(Stderr, "plain\n"); err != nil {
		t.Fatalf("write: %v", err)
	}

	if got := read(); got != "plain\n" {
		t.Errorf("stderr = %q, want %q", got, "plain\n")
	}
}

// TestStderr_ConcurrentWritesAreRaceFree runs with -race to prove log writes,
// progress updates, and the ticker goroutine can share stderr.
func TestStderr_ConcurrentWritesAreRaceFree(t *testing.T) {
	silenceStderr(t)

	c := NewConsole()
	c.StartTask("import", 800)

	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			for range 100 {
				c.UpdateProgress(1)
				_, _ = fmt.Fprint(Stderr, "log\n")
			}
		})
	}
	wg.Wait()
	c.CompleteTask()
}

// TestConsole_StageDuringTaskKeepsTheStageOnScreen pins the rule that the line
// on screen belongs to whoever started last: a task finishing behind a stage
// must not repaint its own banner over the stage's row.
func TestConsole_StageDuringTaskKeepsTheStageOnScreen(t *testing.T) {
	read := captureStderr(t)

	c := NewConsole()
	c.StartTask("import", 100)
	stop := c.StartStage("waiting for lock")
	c.CompleteTask()
	stop()
	_, _ = fmt.Fprint(Stderr, "after\n")

	got := read()
	if strings.Contains(got, "100/100") {
		t.Errorf("completed task banner overwrote the stage line: %q", got)
	}
	if !strings.HasSuffix(got, "after\n") {
		t.Errorf("stage line was not erased before the last write: %q", got)
	}
}

// TestConsole_RestartStopsThePreviousRefresher proves a second StartTask does
// not strand the first refresh goroutine, which would tick forever.
func TestConsole_RestartStopsThePreviousRefresher(t *testing.T) {
	silenceStderr(t)

	c := NewConsole()
	c.StartTask("first", 10)
	first := c.line.done
	c.StartTask("second", 10)
	second := c.line.done
	c.CompleteTask()

	for name, done := range map[string]chan struct{}{"first": first, "second": second} {
		select {
		case <-done:
		default:
			t.Errorf("the %s refresh goroutine is still running", name)
		}
	}
}

package progress

import (
	"fmt"
	"io"
	"os"
)

// Stderr writes to stderr without corrupting the line a progress display keeps
// on screen: the line is erased before the write and drawn again after it.
// Line-oriented output that can happen while a task runs, log records above
// all, must go here instead of os.Stderr.
var Stderr io.Writer = stderrWriter{}

type stderrWriter struct{}

func (stderrWriter) Write(p []byte) (int, error) {
	termMu.Lock()
	defer termMu.Unlock()

	if active == nil {
		return os.Stderr.Write(p)
	}
	// One write, so the record and the line drawn under it reach the terminal
	// together.
	if _, err := fmt.Fprintf(os.Stderr, "%s%s%s", eraseLine, p, active.text()); err != nil {
		return 0, err
	}
	return len(p), nil
}

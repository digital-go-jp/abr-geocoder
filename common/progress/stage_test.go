package progress

import (
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestStage_ShowsElapsedTimeAndClearsOnComplete(t *testing.T) {
	read := captureStderr(t)

	s := startStage("Analyzing tables")
	_, _ = fmt.Fprint(Stderr, "log\n")
	s.complete()
	_, _ = fmt.Fprint(Stderr, "after\n")

	got := read()
	if !strings.Contains(got, "Analyzing tables... 0s") {
		t.Errorf("stage line missing from stderr: %q", got)
	}
	_, after, _ := strings.Cut(got, "after\n")
	if after != "" {
		t.Errorf("stage line was drawn again after complete: %q", after)
	}
	if !strings.HasSuffix(got, "after\n") {
		t.Errorf("stage line was not erased before the last write: %q", got)
	}
}

func TestStage_RenderFormatsElapsed(t *testing.T) {
	s := &stage{name: "Analyzing tables", startTime: time.Now().Add(-90 * time.Second)}

	if got, want := s.render(), "Analyzing tables... 1m30s"; got != want {
		t.Errorf("render() = %q, want %q", got, want)
	}
}

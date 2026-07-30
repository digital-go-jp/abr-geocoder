package command

import (
	"fmt"

	"abr.local/common/progress"
)

// printStatus writes a line of human-facing status. It goes to stderr through
// progress.Stderr, so it cannot land inside a live progress line, and leaves
// stdout free for data. A caller that needs a machine-readable result reads the
// exit code, not this text.
func printStatus(format string, args ...any) {
	_, _ = fmt.Fprintf(progress.Stderr, format+"\n", args...)
}

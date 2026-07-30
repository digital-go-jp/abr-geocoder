package progress

import (
	"abr.local/common/env"
)

// ShouldShowProgress determines if progress should be displayed.
// Returns true if stderr is a TTY, quiet is false, and the terminal did not call
// itself dumb, which is how it says it cannot interpret the escape the display
// redraws with. An unset TERM is left alone: Windows consoles commonly have none.
func ShouldShowProgress(quiet bool) bool {
	return !quiet && env.IsStderrTTY() && env.GetEnv("TERM", "") != "dumb"
}

// NewConsoleIfEnabled creates a Console if progress should be shown, otherwise returns nil.
// This is a convenience function that combines TTY detection with Console creation.
func NewConsoleIfEnabled(quiet bool) Monitor {
	if !ShouldShowProgress(quiet) {
		return nil
	}
	return NewConsole()
}

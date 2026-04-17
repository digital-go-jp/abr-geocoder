package progress

import (
	"abr.local/common/env"
)

// ShouldShowProgress determines if progress should be displayed.
// Returns true if stderr is a TTY and quiet is false.
func ShouldShowProgress(quiet bool) bool {
	return !quiet && env.IsStderrTTY()
}

// NewConsoleIfEnabled creates a Console if progress should be shown, otherwise returns nil.
// This is a convenience function that combines TTY detection with Console creation.
func NewConsoleIfEnabled(quiet bool) Monitor {
	if !ShouldShowProgress(quiet) {
		return nil
	}
	return NewConsole()
}

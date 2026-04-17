// Package env provides utilities for reading environment variables and detecting runtime environment.
package env

import (
	"os"

	"golang.org/x/term"
)

// GetEnv returns the value of the environment variable named by key,
// or the default value if the variable is not set.
// An empty value is returned if the variable is explicitly set to empty.
func GetEnv(key, def string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return def
}

// IsStderrTTY reports whether stderr is connected to a terminal.
// This is useful for determining output format (text vs JSON) and progress display.
func IsStderrTTY() bool {
	return term.IsTerminal(int(os.Stderr.Fd()))
}

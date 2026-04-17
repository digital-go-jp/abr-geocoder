// Package logging provides structured logging setup using slog.
package logging

import (
	"log/slog"
	"os"
	"strings"

	"abr.local/common/env"
)

// NewFromEnv builds a slog.Logger from environment variables.
//
// Environment variables:
//   - LOG_LEVEL: DEBUG|INFO|WARN|ERROR (default: INFO, case-insensitive)
//   - LOG_FORMAT: "json"|"text" (default: auto-detect based on terminal)
//
// When LOG_FORMAT is not set, the format is automatically determined:
//   - text: when running in a terminal (tty)
//   - json: when running in non-interactive mode (CI/CD, pipes, etc.)
func NewFromEnv() *slog.Logger {
	level := parseLevel(env.GetEnv("LOG_LEVEL", "INFO"))
	format := env.GetEnv("LOG_FORMAT", "")
	if format == "" {
		if env.IsStderrTTY() {
			format = "text"
		} else {
			format = "json"
		}
	}
	return slog.New(newHandler(level, format))
}

func parseLevel(s string) slog.Level {
	switch strings.ToUpper(s) {
	case "DEBUG":
		return slog.LevelDebug
	case "WARN":
		return slog.LevelWarn
	case "ERROR":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// newHandler creates a slog.Handler according to format.
func newHandler(level slog.Leveler, format string) slog.Handler {
	opts := &slog.HandlerOptions{Level: level}
	normalized := strings.ToLower(strings.TrimSpace(format))
	if normalized == "json" {
		return slog.NewJSONHandler(os.Stderr, opts)
	}
	return slog.NewTextHandler(os.Stderr, opts)
}

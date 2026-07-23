package logging

import (
	"log/slog"
	"os"
	"testing"
)

func TestParseLevel(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  slog.Level
	}{
		{"debug lowercase", "debug", slog.LevelDebug},
		{"DEBUG uppercase", "DEBUG", slog.LevelDebug},
		{"Debug mixed", "Debug", slog.LevelDebug},
		{"debug with spaces", " debug ", slog.LevelDebug},
		{"DEBUG with spaces", " DEBUG ", slog.LevelDebug},
		{"info lowercase", "info", slog.LevelInfo},
		{"INFO uppercase", "INFO", slog.LevelInfo},
		{"info with spaces", "  info  ", slog.LevelInfo},
		{"warn lowercase", "warn", slog.LevelWarn},
		{"WARN uppercase", "WARN", slog.LevelWarn},
		{"WARN with spaces", " WARN ", slog.LevelWarn},
		{"error lowercase", "error", slog.LevelError},
		{"ERROR uppercase", "ERROR", slog.LevelError},
		{"error with spaces", "  error  ", slog.LevelError},
		{"unknown defaults to info", "unknown", slog.LevelInfo},
		{"empty defaults to info", "", slog.LevelInfo},
		{"invalid defaults to info", "invalid", slog.LevelInfo},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseLevel(tt.input)
			if got != tt.want {
				t.Errorf("parseLevel(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestNewHandler(t *testing.T) {
	tests := []struct {
		name       string
		format     string
		wantIsJSON bool
	}{
		{"json format", "json", true},
		{"JSON uppercase", "JSON", true},
		{"json with spaces", "  json  ", true},
		{"JSON uppercase with spaces", " JSON ", true},
		{"text format", "text", false},
		{"empty defaults to text", "", false},
		{"other defaults to text", "other", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := newHandler(slog.LevelInfo, tt.format)
			if handler == nil {
				t.Fatal("newHandler() returned nil")
			}

			// Check handler type
			_, isJSON := handler.(*slog.JSONHandler)
			if isJSON != tt.wantIsJSON {
				t.Errorf("newHandler(%q) isJSON = %v, want %v", tt.format, isJSON, tt.wantIsJSON)
			}
		})
	}
}

func TestNewFromEnv(t *testing.T) {
	// Save original env vars
	origLevel := os.Getenv("LOG_LEVEL")
	origFormat := os.Getenv("LOG_FORMAT")

	// Restore env vars after test
	defer func() {
		if origLevel == "" {
			os.Unsetenv("LOG_LEVEL")
		} else {
			os.Setenv("LOG_LEVEL", origLevel)
		}
		if origFormat == "" {
			os.Unsetenv("LOG_FORMAT")
		} else {
			os.Setenv("LOG_FORMAT", origFormat)
		}
	}()

	tests := []struct {
		name      string
		level     string
		format    string
		setLevel  bool
		setFormat bool
	}{
		{"defaults", "", "", false, false},
		{"debug json", "DEBUG", "json", true, true},
		{"info text", "INFO", "text", true, true},
		{"only level", "WARN", "", true, false},
		{"only format", "", "text", false, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear env vars
			os.Unsetenv("LOG_LEVEL")
			os.Unsetenv("LOG_FORMAT")

			if tt.setLevel {
				os.Setenv("LOG_LEVEL", tt.level)
			}
			if tt.setFormat {
				os.Setenv("LOG_FORMAT", tt.format)
			}

			logger := NewFromEnv()
			if logger == nil {
				t.Fatal("NewFromEnv() returned nil")
			}
		})
	}
}

func TestNewHandler_Level(t *testing.T) {
	levels := []slog.Level{
		slog.LevelDebug,
		slog.LevelInfo,
		slog.LevelWarn,
		slog.LevelError,
	}

	for _, level := range levels {
		t.Run(level.String(), func(t *testing.T) {
			handler := newHandler(level, "json")
			if handler == nil {
				t.Fatal("newHandler() returned nil")
			}
			// Handler should be enabled for its level and above
			if !handler.Enabled(t.Context(), level) {
				t.Errorf("handler should be enabled for level %v", level)
			}
		})
	}
}

package config

import (
	"os"
	"testing"
	"time"
)

// saveEnvVars saves the specified environment variables and registers cleanup to restore them.
func saveEnvVars(t *testing.T, keys []string) {
	t.Helper()
	origVars := make(map[string]string, len(keys))
	for _, key := range keys {
		origVars[key] = os.Getenv(key)
	}
	t.Cleanup(func() {
		for key, val := range origVars {
			if val == "" {
				_ = os.Unsetenv(key)
			} else {
				_ = os.Setenv(key, val)
			}
		}
	})
}

func TestLoad(t *testing.T) {
	envKeys := []string{"PORT", "CACHE_PATH", "CORS_ALLOW_ORIGIN"}
	saveEnvVars(t, envKeys)

	tests := []struct {
		name                string
		envVars             map[string]string
		wantPort            string
		wantCachePath       string
		wantCORSAllowOrigin string
	}{
		{
			name:                "uses defaults when env not set",
			envVars:             map[string]string{},
			wantPort:            "3000",
			wantCachePath:       defaultCachePath(),
			wantCORSAllowOrigin: "",
		},
		{
			name: "uses env vars when set",
			envVars: map[string]string{
				"PORT":              "8080",
				"CACHE_PATH":        "/tmp/cache.duckdb",
				"CORS_ALLOW_ORIGIN": "https://example.com",
			},
			wantPort:            "8080",
			wantCachePath:       "/tmp/cache.duckdb",
			wantCORSAllowOrigin: "https://example.com",
		},
		{
			name: "partial env - only PORT set",
			envVars: map[string]string{
				"PORT": "9000",
			},
			wantPort:            "9000",
			wantCachePath:       defaultCachePath(),
			wantCORSAllowOrigin: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear all env vars
			for _, key := range envKeys {
				_ = os.Unsetenv(key)
			}

			// Set test env vars
			for k, v := range tt.envVars {
				_ = os.Setenv(k, v)
			}

			cfg := Load()

			if cfg == nil {
				t.Fatal("Load() returned nil")
			}

			if cfg.Server.Port != tt.wantPort {
				t.Errorf("Load().Server.Port = %q, want %q", cfg.Server.Port, tt.wantPort)
			}

			if cfg.Cache.Path != tt.wantCachePath {
				t.Errorf("Load().Cache.Path = %q, want %q", cfg.Cache.Path, tt.wantCachePath)
			}

			if cfg.Server.CORSAllowOrigin != tt.wantCORSAllowOrigin {
				t.Errorf("Load().Server.CORSAllowOrigin = %q, want %q", cfg.Server.CORSAllowOrigin, tt.wantCORSAllowOrigin)
			}
		})
	}
}

// TestLoad_HTTPTimeouts pins the timeout defaults and the duration-string
// override path.
func TestLoad_HTTPTimeouts(t *testing.T) {
	envKeys := []string{"ABRG_HTTP_READ_TIMEOUT", "ABRG_HTTP_WRITE_TIMEOUT", "ABRG_HTTP_IDLE_TIMEOUT"}
	saveEnvVars(t, envKeys)

	tests := []struct {
		name      string
		env       map[string]string
		wantRead  time.Duration
		wantWrite time.Duration
		wantIdle  time.Duration
	}{
		{
			name:      "defaults are 10s, 30s, and 60s",
			env:       map[string]string{},
			wantRead:  10 * time.Second,
			wantWrite: 30 * time.Second,
			wantIdle:  60 * time.Second,
		},
		{
			name: "duration strings override each timeout",
			env: map[string]string{
				"ABRG_HTTP_READ_TIMEOUT":  "5s",
				"ABRG_HTTP_WRITE_TIMEOUT": "1m30s",
				"ABRG_HTTP_IDLE_TIMEOUT":  "2m",
			},
			wantRead:  5 * time.Second,
			wantWrite: 90 * time.Second,
			wantIdle:  2 * time.Minute,
		},
		{
			name: "invalid and non-positive values fall back",
			env: map[string]string{
				"ABRG_HTTP_READ_TIMEOUT":  "fast",
				"ABRG_HTTP_WRITE_TIMEOUT": "-3s",
				"ABRG_HTTP_IDLE_TIMEOUT":  "0",
			},
			wantRead:  10 * time.Second,
			wantWrite: 30 * time.Second,
			wantIdle:  60 * time.Second,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, key := range envKeys {
				_ = os.Unsetenv(key)
			}
			for key, val := range tt.env {
				t.Setenv(key, val)
			}

			cfg := Load()
			if cfg.Server.ReadTimeout != tt.wantRead {
				t.Errorf("ReadTimeout = %v, want %v", cfg.Server.ReadTimeout, tt.wantRead)
			}
			if cfg.Server.WriteTimeout != tt.wantWrite {
				t.Errorf("WriteTimeout = %v, want %v", cfg.Server.WriteTimeout, tt.wantWrite)
			}
			if cfg.Server.IdleTimeout != tt.wantIdle {
				t.Errorf("IdleTimeout = %v, want %v", cfg.Server.IdleTimeout, tt.wantIdle)
			}
		})
	}
}

package config

import (
	"os"
	"testing"
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

package config

import (
	"os"
	"slices"
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
	envKeys := []string{"ABRG_HTTP_PORT", "ABRG_CACHE_PATH", "ABRG_CORS_ALLOW_ORIGIN"}
	saveEnvVars(t, envKeys)

	tests := []struct {
		name                 string
		envVars              map[string]string
		wantPort             string
		wantCachePath        string
		wantCORSAllowOrigins []string
	}{
		{
			name:                 "uses defaults when env not set",
			envVars:              map[string]string{},
			wantPort:             "3000",
			wantCachePath:        defaultCachePath(),
			wantCORSAllowOrigins: []string{"*"},
		},
		{
			name: "uses env vars when set",
			envVars: map[string]string{
				"ABRG_HTTP_PORT":         "8080",
				"ABRG_CACHE_PATH":        "/tmp/cache.duckdb",
				"ABRG_CORS_ALLOW_ORIGIN": "https://example.com",
			},
			wantPort:             "8080",
			wantCachePath:        "/tmp/cache.duckdb",
			wantCORSAllowOrigins: []string{"https://example.com"},
		},
		{
			name: "partial env - only PORT set",
			envVars: map[string]string{
				"ABRG_HTTP_PORT": "9000",
			},
			wantPort:             "9000",
			wantCachePath:        defaultCachePath(),
			wantCORSAllowOrigins: []string{"*"},
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

			if !slices.Equal(cfg.Server.CORSAllowOrigins, tt.wantCORSAllowOrigins) {
				t.Errorf("Load().Server.CORSAllowOrigins = %q, want %q", cfg.Server.CORSAllowOrigins, tt.wantCORSAllowOrigins)
			}
		})
	}
}

func TestServerConfigAddr(t *testing.T) {
	tests := []struct {
		name string
		host string
		want string
	}{
		{name: "every interface when host is not set", host: "", want: ":3000"},
		{name: "IPv4 loopback", host: "127.0.0.1", want: "127.0.0.1:3000"},
		{name: "IPv6 loopback", host: "::1", want: "[::1]:3000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("ABRG_HTTP_PORT", "3000")
			t.Setenv("ABRG_HTTP_HOST", tt.host)

			if got := Load().Server.Addr(); got != tt.want {
				t.Errorf("Addr() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestLoadCORSAllowOrigins covers the comma-separated form, which lets more
// than one frontend be allowed, and the values that must not leave the list
// empty: the middleware rejects a configuration allowing no origin at all.
func TestLoadCORSAllowOrigins(t *testing.T) {
	saveEnvVars(t, []string{"ABRG_CORS_ALLOW_ORIGIN"})

	tests := []struct {
		name  string
		value string
		want  []string
	}{
		{
			name:  "unset falls back to the default",
			value: "",
			want:  []string{"*"},
		},
		{
			name:  "one origin",
			value: "https://example.com",
			want:  []string{"https://example.com"},
		},
		{
			name:  "several origins",
			value: "https://a.example,https://b.example",
			want:  []string{"https://a.example", "https://b.example"},
		},
		{
			name:  "spaces and empty entries are ignored",
			value: " https://a.example , , https://b.example ",
			want:  []string{"https://a.example", "https://b.example"},
		},
		{
			name:  "a value that leaves nothing falls back to the default",
			value: " , ",
			want:  []string{"*"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.value == "" {
				_ = os.Unsetenv("ABRG_CORS_ALLOW_ORIGIN")
			} else {
				t.Setenv("ABRG_CORS_ALLOW_ORIGIN", tt.value)
			}

			got := Load().Server.CORSAllowOrigins
			if !slices.Equal(got, tt.want) {
				t.Errorf("CORSAllowOrigins = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestLoad_HTTPTimeouts pins the timeout values the server runs with.
func TestLoad_HTTPTimeouts(t *testing.T) {
	cfg := Load()
	if cfg.Server.ReadTimeout != 10*time.Second {
		t.Errorf("ReadTimeout = %v, want %v", cfg.Server.ReadTimeout, 10*time.Second)
	}
	if cfg.Server.WriteTimeout != 30*time.Second {
		t.Errorf("WriteTimeout = %v, want %v", cfg.Server.WriteTimeout, 30*time.Second)
	}
	if cfg.Server.IdleTimeout != 60*time.Second {
		t.Errorf("IdleTimeout = %v, want %v", cfg.Server.IdleTimeout, 60*time.Second)
	}
}

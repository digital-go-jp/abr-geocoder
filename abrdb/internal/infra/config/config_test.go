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
	envKeys := []string{
		"DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_SSLMODE",
		"ABRDB_FEED_URL", "ABRDB_DOWNLOAD_DIR",
	}
	saveEnvVars(t, envKeys)

	tests := []struct {
		name            string
		envVars         map[string]string
		wantFeedURL     string
		wantDownloadDir string
	}{
		{
			name:            "uses defaults",
			envVars:         map[string]string{},
			wantFeedURL:     DefaultFeedURL,
			wantDownloadDir: DefaultDownloadDir,
		},
		{
			name: "uses env vars",
			envVars: map[string]string{
				"ABRDB_FEED_URL":     "https://custom.example.com/feed.json",
				"ABRDB_DOWNLOAD_DIR": "/custom/data",
			},
			wantFeedURL:     "https://custom.example.com/feed.json",
			wantDownloadDir: "/custom/data",
		},
		{
			name: "partial env vars",
			envVars: map[string]string{
				"ABRDB_DOWNLOAD_DIR": "/my/data",
			},
			wantFeedURL:     DefaultFeedURL,
			wantDownloadDir: "/my/data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear all env vars
			for _, key := range envKeys {
				_ = os.Unsetenv(key)
			}

			// Set test env vars
			for key, val := range tt.envVars {
				_ = os.Setenv(key, val)
			}

			config := Load()

			if config == nil {
				t.Fatal("Load() returned nil")
			}

			if config.API.FeedURL != tt.wantFeedURL {
				t.Errorf("API.FeedURL = %q, want %q", config.API.FeedURL, tt.wantFeedURL)
			}

			if config.Process.DownloadDir != tt.wantDownloadDir {
				t.Errorf("Process.DownloadDir = %q, want %q", config.Process.DownloadDir, tt.wantDownloadDir)
			}
		})
	}
}

func TestConfig_DatabaseIntegration(t *testing.T) {
	saveEnvVars(t, []string{"DB_HOST", "DB_PORT"})

	_ = os.Unsetenv("DB_HOST")
	_ = os.Unsetenv("DB_PORT")

	config := Load()

	// Database config should have default value when env vars are not set
	if config.Database.Host != "localhost" {
		t.Errorf("Database.Host = %q, want default 'localhost'", config.Database.Host)
	}
}

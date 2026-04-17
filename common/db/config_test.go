package db

import (
	"os"
	"strings"
	"testing"
)

func TestDBConfig_DSN(t *testing.T) {
	tests := []struct {
		name   string
		config DBConfig
		want   string
	}{
		{
			name: "full config",
			config: DBConfig{
				Host:     "localhost",
				Port:     "5432",
				Database: "testdb",
				User:     "testuser",
				Password: "testpass",
				SSLMode:  "disable",
			},
			want: "postgres://testuser:testpass@localhost:5432/testdb?sslmode=disable",
		},
		{
			name: "empty password",
			config: DBConfig{
				Host:     "localhost",
				Port:     "5432",
				Database: "testdb",
				User:     "testuser",
				Password: "",
				SSLMode:  "disable",
			},
			want: "postgres://testuser@localhost:5432/testdb?sslmode=disable",
		},
		{
			name: "remote host with ssl",
			config: DBConfig{
				Host:     "db.example.com",
				Port:     "5433",
				Database: "testdb",
				User:     "testuser",
				Password: "testpass",
				SSLMode:  "require",
			},
			want: "postgres://testuser:testpass@db.example.com:5433/testdb?sslmode=require",
		},
		{
			name: "special characters in password",
			config: DBConfig{
				Host:     "localhost",
				Port:     "5432",
				Database: "testdb",
				User:     "testuser",
				Password: "pass word@#%",
				SSLMode:  "prefer",
			},
			want: "postgres://testuser:pass%20word%40%23%25@localhost:5432/testdb?sslmode=prefer",
		},
		{
			name: "special characters in username",
			config: DBConfig{
				Host:     "localhost",
				Port:     "5432",
				Database: "testdb",
				User:     "test@example.com",
				Password: "testpass",
				SSLMode:  "disable",
			},
			want: "postgres://test%40example.com:testpass@localhost:5432/testdb?sslmode=disable",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.config.DSN()
			if got != tt.want {
				t.Errorf("DSN() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestLoadDBConfigFromEnv(t *testing.T) {
	// Save original env vars
	origVars := map[string]string{}
	envKeys := []string{"DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_SSLMODE"}
	for _, key := range envKeys {
		origVars[key] = os.Getenv(key)
	}

	// Restore env vars after test
	defer func() {
		for key, val := range origVars {
			if val == "" {
				os.Unsetenv(key)
			} else {
				os.Setenv(key, val)
			}
		}
	}()

	tests := []struct {
		name     string
		envVars  map[string]string
		wantHost string
		wantPort string
		wantDB   string
		wantUser string
		wantPass string
		wantSSL  string
	}{
		{
			name:     "uses defaults when env not set",
			envVars:  map[string]string{},
			wantHost: "localhost",
			wantPort: "5432",
			wantDB:   "abrdb",
			wantUser: "postgres",
			wantPass: "",
			wantSSL:  "prefer",
		},
		{
			name: "uses env vars when set",
			envVars: map[string]string{
				"DB_HOST":     "custom-host",
				"DB_PORT":     "5433",
				"DB_NAME":     "custom-db",
				"DB_USER":     "custom-user",
				"DB_PASSWORD": "custom-pass",
				"DB_SSLMODE":  "require",
			},
			wantHost: "custom-host",
			wantPort: "5433",
			wantDB:   "custom-db",
			wantUser: "custom-user",
			wantPass: "custom-pass",
			wantSSL:  "require",
		},
		{
			name: "partial env vars use defaults for missing",
			envVars: map[string]string{
				"DB_HOST": "partial-host",
				"DB_NAME": "partial-db",
			},
			wantHost: "partial-host",
			wantPort: "5432",
			wantDB:   "partial-db",
			wantUser: "postgres",
			wantPass: "",
			wantSSL:  "prefer",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear all env vars
			for _, key := range envKeys {
				os.Unsetenv(key)
			}

			// Set test env vars
			for key, val := range tt.envVars {
				os.Setenv(key, val)
			}

			config := LoadDBConfigFromEnv()

			if config.Host != tt.wantHost {
				t.Errorf("Host = %q, want %q", config.Host, tt.wantHost)
			}
			if config.Port != tt.wantPort {
				t.Errorf("Port = %q, want %q", config.Port, tt.wantPort)
			}
			if config.Database != tt.wantDB {
				t.Errorf("Database = %q, want %q", config.Database, tt.wantDB)
			}
			if config.User != tt.wantUser {
				t.Errorf("User = %q, want %q", config.User, tt.wantUser)
			}
			if config.Password != tt.wantPass {
				t.Errorf("Password = %q, want %q", config.Password, tt.wantPass)
			}
			if config.SSLMode != tt.wantSSL {
				t.Errorf("SSLMode = %q, want %q", config.SSLMode, tt.wantSSL)
			}
		})
	}
}

func TestDBConfig_DSN_ContainsAllFields(t *testing.T) {
	config := DBConfig{
		Host:     "testhost",
		Port:     "1234",
		Database: "testdb",
		User:     "testuser",
		Password: "testpass",
		SSLMode:  "verify-full",
	}

	dsn := config.DSN()

	// For URL format: postgres://user:password@host:port/database?sslmode=mode
	requiredParts := []string{
		"postgres://",
		"testuser",
		"testpass",
		"testhost",
		"1234",
		"testdb",
		"sslmode=verify-full",
	}

	for _, part := range requiredParts {
		if !strings.Contains(dsn, part) {
			t.Errorf("DSN() = %q, should contain %q", dsn, part)
		}
	}
}

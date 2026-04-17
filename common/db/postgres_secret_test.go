package db

import (
	"strings"
	"testing"
)

func TestBuildPostgresSecretSQL(t *testing.T) {
	cfg := DBConfig{
		Host:     "db.example.com",
		Port:     "5432",
		Database: "abrdb",
		User:     "alice",
		Password: "s3cret",
		SSLMode:  "require",
	}
	got := BuildPostgresSecretSQL(cfg, "abrdb_pg_secret")
	want := "CREATE OR REPLACE SECRET abrdb_pg_secret (TYPE postgres, HOST 'db.example.com', PORT 5432, DATABASE 'abrdb', USER 'alice', PASSWORD 's3cret')"
	if got != want {
		t.Errorf("BuildPostgresSecretSQL mismatch:\n got: %s\nwant: %s", got, want)
	}
}

func TestBuildPostgresSecretSQL_EscapesSingleQuote(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "5432",
		Database: "d",
		User:     "u",
		Password: "pa'ss",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if !strings.Contains(got, "PASSWORD 'pa''ss'") {
		t.Errorf("expected single quote to be escaped as '', got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_EscapesHostname(t *testing.T) {
	cfg := DBConfig{
		Host:     "db'host.com",
		Port:     "5432",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if !strings.Contains(got, "HOST 'db''host.com'") {
		t.Errorf("expected hostname quote to be escaped, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_EscapesDatabase(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "5432",
		Database: "db'name",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if !strings.Contains(got, "DATABASE 'db''name'") {
		t.Errorf("expected database quote to be escaped, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_EscapesUser(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "5432",
		Database: "d",
		User:     "us'er",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if !strings.Contains(got, "USER 'us''er'") {
		t.Errorf("expected user quote to be escaped, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_OmitsEmptyPassword(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "5432",
		Database: "d",
		User:     "u",
		Password: "",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "PASSWORD") {
		t.Errorf("expected no PASSWORD clause for empty password, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_OmitsEmptyHost(t *testing.T) {
	cfg := DBConfig{
		Host:     "",
		Port:     "5432",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "HOST") {
		t.Errorf("expected no HOST clause for empty host, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_OmitsEmptyDatabase(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "5432",
		Database: "",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "DATABASE") {
		t.Errorf("expected no DATABASE clause for empty database, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_OmitsEmptyUser(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "5432",
		Database: "d",
		User:     "",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "USER") {
		t.Errorf("expected no USER clause for empty user, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_ValidatesPortNumeric(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "5432",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if !strings.Contains(got, "PORT 5432") {
		t.Errorf("expected PORT 5432 (numeric, no quotes), got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_SkipsInvalidPort(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "invalid",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "PORT") {
		t.Errorf("expected invalid port to be skipped, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_SkipsEmptyPort(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "PORT") {
		t.Errorf("expected empty port to be skipped, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_HandlesComplexPassword(t *testing.T) {
	cfg := DBConfig{
		Host:     "db.example.com",
		Port:     "5432",
		Database: "abrdb",
		User:     "alice",
		Password: "p@ss'w\"rd!",
	}
	got := BuildPostgresSecretSQL(cfg, "secret")
	if !strings.Contains(got, "PASSWORD 'p@ss''w\"rd!'") {
		t.Errorf("expected complex password to be properly escaped, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_PreserveSecretName(t *testing.T) {
	tests := []struct {
		name       string
		secretName string
	}{
		{"simple", "my_secret"},
		{"with_underscore", "abrdb_pg_secret"},
		{"with_number", "secret_123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := DBConfig{
				Host:     "h",
				Port:     "5432",
				Database: "d",
				User:     "u",
			}
			got := BuildPostgresSecretSQL(cfg, tt.secretName)
			if !strings.Contains(got, "CREATE OR REPLACE SECRET "+tt.secretName) {
				t.Errorf("expected secret name %q in output, got: %s", tt.secretName, got)
			}
		})
	}
}

func TestBuildPostgresSecretSQL_MinimalConfig(t *testing.T) {
	cfg := DBConfig{}
	got := BuildPostgresSecretSQL(cfg, "s")
	want := "CREATE OR REPLACE SECRET s (TYPE postgres)"
	if got != want {
		t.Errorf("minimal config mismatch:\n got: %s\nwant: %s", got, want)
	}
}

func TestBuildPostgresSecretSQL_PortZeroPadding(t *testing.T) {
	// Valid zero-padded ports like "0443" are normalized to integer (443)
	cfg := DBConfig{
		Host:     "h",
		Port:     "0443",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if !strings.Contains(got, "PORT 443") {
		// strconv.Atoi("0443") == 443, so zero-padded values are normalized
		t.Errorf("expected PORT 443 (zero-padded port normalized), got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_RejectsNegativePort(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "-1",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "PORT") {
		t.Errorf("expected negative port to be rejected, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_RejectsPortZero(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "0",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "PORT") {
		t.Errorf("expected port 0 to be rejected, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_RejectsPortAboveMax(t *testing.T) {
	cfg := DBConfig{
		Host:     "h",
		Port:     "65536",
		Database: "d",
		User:     "u",
	}
	got := BuildPostgresSecretSQL(cfg, "s")
	if strings.Contains(got, "PORT") {
		t.Errorf("expected port 65536 to be rejected, got: %s", got)
	}
}

func TestBuildPostgresSecretSQL_AcceptsValidPortRange(t *testing.T) {
	tests := []struct {
		name string
		port string
		want bool
	}{
		{"min_valid_port", "1", true},
		{"common_http", "80", true},
		{"common_postgres", "5432", true},
		{"max_valid_port", "65535", true},
		{"zero_padded", "0443", true},
		{"just_above_max", "65536", false},
		{"large_number", "99999", false},
		{"negative", "-5432", false},
		{"plus_prefix", "+5432", true}, // strconv.Atoi accepts leading +
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := DBConfig{
				Host:     "h",
				Port:     tt.port,
				Database: "d",
				User:     "u",
			}
			got := BuildPostgresSecretSQL(cfg, "s")
			hasPort := strings.Contains(got, "PORT")
			if hasPort != tt.want {
				if tt.want {
					t.Errorf("port %q should be accepted, got: %s", tt.port, got)
				} else {
					t.Errorf("port %q should be rejected, got: %s", tt.port, got)
				}
			}
		})
	}
}

package db

import (
	"strings"
	"testing"
)

func TestBuildPostgresAttachSQL(t *testing.T) {
	tests := []struct {
		name     string
		sslMode  string
		secret   string
		readOnly bool
		want     string
	}{
		{
			name:    "with sslmode",
			sslMode: "require",
			secret:  "abrdb_pg_secret",
			want:    "ATTACH 'sslmode=require' AS pg (TYPE postgres, SECRET abrdb_pg_secret)",
		},
		{
			name:    "empty sslmode omitted",
			sslMode: "",
			secret:  "abrdb_pg_secret",
			want:    "ATTACH '' AS pg (TYPE postgres, SECRET abrdb_pg_secret)",
		},
		{
			name:     "read only",
			sslMode:  "prefer",
			secret:   "pg_secret",
			readOnly: true,
			want:     "ATTACH 'sslmode=prefer' AS pg (TYPE postgres, READ_ONLY, SECRET pg_secret)",
		},
		{
			name:    "single quotes escaped",
			sslMode: "pre'fer",
			secret:  "s",
			want:    "ATTACH 'sslmode=pre''fer' AS pg (TYPE postgres, SECRET s)",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BuildPostgresAttachSQL(tt.sslMode, tt.secret, tt.readOnly)
			if got != tt.want {
				t.Errorf("BuildPostgresAttachSQL() = %q, want %q", got, tt.want)
			}
		})
	}
}

// Regression test: credentials live only in the SECRET, never in ATTACH SQL.
func TestBuildPostgresAttachSQL_DoesNotContainCredentials(t *testing.T) {
	cfg := DBConfig{
		Host: "h", Port: "5432", Database: "d", User: "u",
		Password: "super_secret_pw_do_not_leak",
		SSLMode:  "require",
	}
	attachSQL := BuildPostgresAttachSQL(cfg.SSLMode, "s", false)
	if strings.Contains(attachSQL, cfg.Password) {
		t.Errorf("password leaked into ATTACH SQL: %s", attachSQL)
	}
}

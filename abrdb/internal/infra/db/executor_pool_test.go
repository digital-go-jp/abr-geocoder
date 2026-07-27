package db

import "testing"

// TestDSNWithPoolSize pins that the pool grows with the configured worker
// parallelism and that leaving both variables unset keeps the DSN (and thus
// the pgxpool default) untouched.
func TestDSNWithPoolSize(t *testing.T) {
	const dsn = "postgres://u@h:5432/d?sslmode=disable"

	tests := []struct {
		name     string
		imports  string
		download string
		want     string
	}{
		{name: "both unset keeps default", want: dsn},
		{name: "import concurrency sizes the pool", imports: "8", want: dsn + "&pool_max_conns=12"},
		{name: "download concurrency sizes the pool", download: "6", want: dsn + "&pool_max_conns=10"},
		{name: "larger of the two wins", imports: "4", download: "9", want: dsn + "&pool_max_conns=13"},
		{name: "clamped to the cap", imports: "100", want: dsn + "&pool_max_conns=36"},
		{name: "invalid value keeps default", imports: "abc", want: dsn},
		{name: "non-positive value keeps default", imports: "0", want: dsn},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Setenv("ABRDB_IMPORT_CONCURRENCY", tt.imports)
			t.Setenv("ABRDB_DOWNLOAD_CONCURRENCY", tt.download)
			if got := dsnWithPoolSize(dsn); got != tt.want {
				t.Errorf("dsnWithPoolSize() = %q, want %q", got, tt.want)
			}
		})
	}
}

package db

import (
	"fmt"
	"runtime"
	"testing"

	"abrdb/internal/util"
)

// TestDSNWithPoolSize pins the pool-sizing rule: the pool covers the larger of
// the two effective worker counts, where a stage without a valid setting still
// runs GOMAXPROCS workers. Without any valid setting the DSN (and thus the
// pgxpool default) stays untouched.
func TestDSNWithPoolSize(t *testing.T) {
	const dsn = "postgres://u@h:5432/d?sslmode=disable"
	gomaxprocs := runtime.GOMAXPROCS(0)
	withPool := func(workers int) string {
		return fmt.Sprintf("%s&pool_max_conns=%d", dsn, workers+4)
	}

	tests := []struct {
		name     string
		imports  string
		download string
		want     string
	}{
		{name: "both unset keeps default", want: dsn},
		{name: "small explicit value still covers the unset stage", imports: "1", want: withPool(max(gomaxprocs, 1))},
		{name: "download setting alone", download: "6", want: withPool(max(gomaxprocs, 6))},
		{name: "larger effective count wins", imports: "4", download: "9", want: withPool(max(gomaxprocs, 9))},
		{name: "explicit value clamped to the cap", imports: "100", want: withPool(max(gomaxprocs, util.MaxConcurrency))},
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

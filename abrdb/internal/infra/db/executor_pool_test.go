package db

import (
	"fmt"
	"runtime"
	"testing"

	"abrdb/internal/util"
)

// TestDSNWithPoolSize pins the rule documented on dsnWithPoolSize.
func TestDSNWithPoolSize(t *testing.T) {
	const dsn = "postgres://u@h:5432/d?sslmode=disable"
	gomaxprocs := min(runtime.GOMAXPROCS(0), util.MaxConcurrency)
	withPool := func(workers int) string {
		return fmt.Sprintf("%s&pool_max_conns=%d", dsn, workers+4)
	}

	tests := []struct {
		name     string
		imports  string
		download string
		want     string
	}{
		{name: "both unset covers the GOMAXPROCS workers each stage runs", want: withPool(gomaxprocs)},
		{name: "small explicit value still covers the unset stage", imports: "1", want: withPool(max(gomaxprocs, 1))},
		{name: "download setting alone", download: "6", want: withPool(max(gomaxprocs, 6))},
		{name: "both set uses the larger explicit value without a GOMAXPROCS floor", imports: "4", download: "9", want: withPool(9)},
		{name: "both set to one worker each", imports: "1", download: "1", want: withPool(1)},
		{name: "explicit value clamped to the cap", imports: "100", download: "1", want: withPool(util.MaxConcurrency)},
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

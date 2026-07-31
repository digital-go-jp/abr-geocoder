package util

import (
	"runtime"
	"testing"
)

func TestConcurrencyLimit(t *testing.T) {
	const envName = "ABRDB_TEST_CONCURRENCY"
	gomaxprocs := runtime.GOMAXPROCS(0)

	tests := []struct {
		name  string
		value string
		set   bool
		want  int
	}{
		{name: "unset falls back to GOMAXPROCS", set: false, want: gomaxprocs},
		{name: "empty falls back to GOMAXPROCS", set: true, value: "", want: gomaxprocs},
		{name: "explicit value", set: true, value: "8", want: 8},
		{name: "clamped to the cap", set: true, value: "100", want: MaxConcurrency},
		{name: "non-numeric falls back", set: true, value: "abc", want: gomaxprocs},
		{name: "zero falls back", set: true, value: "0", want: gomaxprocs},
		{name: "negative falls back", set: true, value: "-3", want: gomaxprocs},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.set {
				t.Setenv(envName, tt.value)
			}
			if got := concurrencyLimit(envName); got != tt.want {
				t.Errorf("concurrencyLimit(%q=%q) = %d, want %d", envName, tt.value, got, tt.want)
			}
		})
	}
}

// TestDefaultLimitIsReadOnce pins that an unconfigured stage keeps reporting
// the limit the connection pool was sized against. Go raises GOMAXPROCS on
// its own when a container's CPU allowance grows, and the pool is sized once
// at startup and lives for the whole process.
func TestDefaultLimitIsReadOnce(t *testing.T) {
	const envName = "ABRDB_TEST_UNSET_CONCURRENCY"
	atStartup := concurrencyLimit(envName)

	previous := runtime.GOMAXPROCS(atStartup + 3)
	t.Cleanup(func() { runtime.GOMAXPROCS(previous) })

	if got := concurrencyLimit(envName); got != atStartup {
		t.Errorf("concurrencyLimit after a GOMAXPROCS change = %d, want %d", got, atStartup)
	}
}

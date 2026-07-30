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
			if got, _ := ConcurrencyLimit(envName); got != tt.want {
				t.Errorf("ConcurrencyLimit(%q=%q) = %d, want %d", envName, tt.value, got, tt.want)
			}
		})
	}
}

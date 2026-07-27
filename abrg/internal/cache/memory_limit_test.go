package cache

import "testing"

// TestCacheMemoryLimit pins the default and the accepted value format: the
// value is interpolated into a SET statement, so anything outside the DuckDB
// memory-limit literal grammar must fall back to the default.
func TestCacheMemoryLimit(t *testing.T) {
	tests := []struct {
		name  string
		value string
		set   bool
		want  string
	}{
		{name: "unset keeps the 8GB default", set: false, want: "8GB"},
		{name: "empty keeps the default", set: true, value: "", want: "8GB"},
		{name: "plain gigabytes", set: true, value: "16GB", want: "16GB"},
		{name: "binary units", set: true, value: "512MiB", want: "512MiB"},
		{name: "fractional value", set: true, value: "1.5GB", want: "1.5GB"},
		{name: "missing unit falls back", set: true, value: "8", want: "8GB"},
		{name: "injection attempt falls back", set: true, value: "8GB'; DROP TABLE x; --", want: "8GB"},
		{name: "negative falls back", set: true, value: "-1GB", want: "8GB"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.set {
				t.Setenv("ABRG_CACHE_MEMORY_LIMIT", tt.value)
			}
			if got := cacheMemoryLimit(); got != tt.want {
				t.Errorf("cacheMemoryLimit() = %q, want %q", got, tt.want)
			}
		})
	}
}

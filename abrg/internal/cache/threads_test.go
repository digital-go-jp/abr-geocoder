package cache

import (
	"context"
	"testing"
)

func TestApplyThreadLimit_InvalidValue(t *testing.T) {
	for _, v := range []string{"abc", "-1", "1.5", ""} {
		t.Run(v, func(t *testing.T) {
			t.Setenv("ABRG_DUCKDB_THREADS", v)
			if err := applyThreadLimit(context.Background(), nil); err == nil {
				t.Errorf("applyThreadLimit(%q) = nil, want error", v)
			}
		})
	}
}

func TestApplyThreadLimit_ZeroKeepsDefault(t *testing.T) {
	t.Setenv("ABRG_DUCKDB_THREADS", "0")
	// nil conn: value 0 must return before touching the connection.
	if err := applyThreadLimit(context.Background(), nil); err != nil {
		t.Errorf("applyThreadLimit(0) = %v, want nil", err)
	}
}

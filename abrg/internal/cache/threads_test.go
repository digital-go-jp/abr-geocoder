package cache

import (
	"context"
	"testing"
)

func TestApplyThreadLimit_InvalidValue(t *testing.T) {
	for _, v := range []string{"abc", "-1", "1.5", ""} {
		t.Run(v, func(t *testing.T) {
			if err := applyThreadLimit(context.Background(), nil, v); err == nil {
				t.Errorf("applyThreadLimit(%q) = nil, want error", v)
			}
		})
	}
}

func TestApplyThreadLimit_ZeroKeepsDefault(t *testing.T) {
	// nil conn: value 0 must return before touching the connection.
	if err := applyThreadLimit(context.Background(), nil, "0"); err != nil {
		t.Errorf("applyThreadLimit(0) = %v, want nil", err)
	}
}

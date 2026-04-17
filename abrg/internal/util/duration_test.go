package util

import (
	"testing"
	"time"
)

func TestDurationMs(t *testing.T) {
	tests := []struct {
		name     string
		duration time.Duration
		want     float64
	}{
		{"zero", 0, 0.0},
		{"1ms", time.Millisecond, 1.0},
		{"1s", time.Second, 1000.0},
		{"500us", 500 * time.Microsecond, 0.5},
		{"1500us", 1500 * time.Microsecond, 1.5},
		{"100ms", 100 * time.Millisecond, 100.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DurationMs(tt.duration)
			if got != tt.want {
				t.Errorf("DurationMs(%v) = %v, want %v", tt.duration, got, tt.want)
			}
		})
	}
}

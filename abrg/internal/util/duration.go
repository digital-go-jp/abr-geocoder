package util

import "time"

// DurationMs converts a time.Duration to milliseconds as a float64.

func DurationMs(d time.Duration) float64 {
	return float64(d.Microseconds()) / 1000.0
}

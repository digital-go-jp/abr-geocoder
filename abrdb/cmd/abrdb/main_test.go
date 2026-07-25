package main

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"abrdb/internal/cli/command"
)

// TestExitCode pins the exit code contract that the AWS Step Functions daily
// workflow depends on: 0 = no changes / success, 1 = dry-run found pending
// changes, 2 = failure.
func TestExitCode(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want int
	}{
		{
			name: "nil error is success",
			err:  nil,
			want: 0,
		},
		{
			name: "changes pending error exits 1",
			err:  command.ChangesPendingError{Message: "changes pending"},
			want: 1,
		},
		{
			name: "wrapped changes pending error exits 1",
			err:  fmt.Errorf("dry-run: %w", command.ChangesPendingError{Message: "changes pending"}),
			want: 1,
		},
		{
			name: "generic error exits 2",
			err:  errors.New("connection refused"),
			want: 2,
		},
		{
			name: "wrapped generic error exits 2",
			err:  fmt.Errorf("scan and compare catalog: %w", errors.New("http 500")),
			want: 2,
		},
		{
			name: "context canceled exits 2",
			err:  context.Canceled,
			want: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := exitCode(tt.err); got != tt.want {
				t.Errorf("exitCode(%v) = %d, want %d", tt.err, got, tt.want)
			}
		})
	}
}

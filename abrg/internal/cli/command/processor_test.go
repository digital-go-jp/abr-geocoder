package command

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
)

// TestResult is a simple result type for testing.
type TestResult struct {
	Address string `json:"address"`
	Result  string `json:"result"`
}

func TestParallelProcessor_Run_Basic(t *testing.T) {
	input := "address1\naddress2\naddress3\n"
	r := strings.NewReader(input)
	var buf bytes.Buffer

	p := &parallelProcessor[TestResult]{
		Process: func(ctx context.Context, address string) (TestResult, error) {
			return TestResult{Address: address, Result: "processed"}, nil
		},
		Workers:    2,
		BufferSize: 10,
	}

	err := p.Run(t.Context(), r, &buf)
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	// Verify output contains all 3 results
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 3 {
		t.Errorf("expected 3 output lines, got %d: %v", len(lines), lines)
	}

	// Verify order is preserved
	for i, line := range lines {
		var result TestResult
		if err := json.Unmarshal([]byte(line), &result); err != nil {
			t.Errorf("line %d: failed to parse JSON: %v", i, err)
			continue
		}
		expected := "address" + string(rune('1'+i))
		if result.Address != expected {
			t.Errorf("line %d: expected address %q, got %q", i, expected, result.Address)
		}
	}
}

func TestParallelProcessor_Run_EmptyInput(t *testing.T) {
	r := strings.NewReader("")
	var buf bytes.Buffer

	p := &parallelProcessor[TestResult]{
		Process: func(ctx context.Context, address string) (TestResult, error) {
			return TestResult{Address: address}, nil
		},
		Workers:    1,
		BufferSize: 10,
	}

	err := p.Run(t.Context(), r, &buf)
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	if buf.Len() != 0 {
		t.Errorf("expected empty output, got %q", buf.String())
	}
}

func TestParallelProcessor_Run_SkipEmptyLines(t *testing.T) {
	input := "address1\n\n\naddress2\n"
	r := strings.NewReader(input)
	var buf bytes.Buffer

	p := &parallelProcessor[TestResult]{
		Process: func(ctx context.Context, address string) (TestResult, error) {
			return TestResult{Address: address}, nil
		},
		Workers:    1,
		BufferSize: 10,
	}

	err := p.Run(t.Context(), r, &buf)
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 2 {
		t.Errorf("expected 2 output lines (empty lines skipped), got %d", len(lines))
	}
}

func TestParallelProcessor_Run_WithError(t *testing.T) {
	input := "good\nbad\ngood2\n"
	r := strings.NewReader(input)
	var buf bytes.Buffer

	p := &parallelProcessor[TestResult]{
		Process: func(ctx context.Context, address string) (TestResult, error) {
			if address == "bad" {
				return TestResult{}, errors.New("processing failed")
			}
			return TestResult{Address: address, Result: "ok"}, nil
		},
		Workers:    1,
		BufferSize: 10,
	}

	err := p.Run(t.Context(), r, &buf)
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 3 {
		t.Errorf("expected 3 output lines, got %d", len(lines))
	}

	// Check error response for "bad" input
	var errResp errorResponse
	if err := json.Unmarshal([]byte(lines[1]), &errResp); err != nil {
		t.Fatalf("failed to parse error response: %v", err)
	}
	if errResp.Error != "processing failed" {
		t.Errorf("expected error 'processing failed', got %q", errResp.Error)
	}
	if errResp.Input != "bad" {
		t.Errorf("expected input 'bad', got %q", errResp.Input)
	}
}

func TestParallelProcessor_Run_ContextCancellation(t *testing.T) {
	input := "address1\naddress2\naddress3\n"
	r := strings.NewReader(input)
	var buf bytes.Buffer

	ctx, cancel := context.WithCancel(t.Context())
	cancel() // Cancel immediately

	p := &parallelProcessor[TestResult]{
		Process: func(ctx context.Context, address string) (TestResult, error) {
			return TestResult{Address: address}, nil
		},
		Workers:    1,
		BufferSize: 10,
	}

	// Should complete without hanging and return context error
	err := p.Run(ctx, r, &buf)
	if err != nil && !errors.Is(err, context.Canceled) {
		t.Errorf("Run() error = %v, want nil or context.Canceled", err)
	}

	// Output should be empty or partial (no items processed due to immediate cancellation)
	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if buf.Len() > 0 && len(lines) > 3 {
		t.Errorf("expected at most 3 output lines, got %d", len(lines))
	}
}

func TestParallelProcessor_Run_OrderPreservation(t *testing.T) {
	// Test with many items to ensure order is preserved
	var inputLines []string
	for i := range 100 {
		inputLines = append(inputLines, fmt.Sprintf("addr%03d", i))
	}
	input := strings.Join(inputLines, "\n") + "\n"
	r := strings.NewReader(input)
	var buf bytes.Buffer

	p := &parallelProcessor[TestResult]{
		Process: func(ctx context.Context, address string) (TestResult, error) {
			return TestResult{Address: address, Result: "done"}, nil
		},
		Workers:    4,
		BufferSize: 20,
	}

	err := p.Run(t.Context(), r, &buf)
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != len(inputLines) {
		t.Errorf("expected %d output lines, got %d", len(inputLines), len(lines))
	}

	// Verify order
	for i, line := range lines {
		var result TestResult
		if err := json.Unmarshal([]byte(line), &result); err != nil {
			t.Errorf("line %d: failed to parse JSON: %v", i, err)
			continue
		}
		if result.Address != inputLines[i] {
			t.Errorf("line %d: expected %q, got %q", i, inputLines[i], result.Address)
		}
	}
}

// mockMonitor implements progress.Monitor for testing.
type mockMonitor struct {
	progress  int64
	completed bool
	cancelled bool
}

func (m *mockMonitor) StartTask(name string, total int64) {}

func (m *mockMonitor) UpdateProgress(delta int64) {
	m.progress += delta
}

func (m *mockMonitor) CompleteTask() {
	m.completed = true
}

func (m *mockMonitor) Cancel() {
	m.cancelled = true
}

func TestParallelProcessor_Run_WithMonitor(t *testing.T) {
	input := "a\nb\nc\n"
	r := strings.NewReader(input)
	var buf bytes.Buffer
	monitor := &mockMonitor{}

	p := &parallelProcessor[TestResult]{
		Process: func(ctx context.Context, address string) (TestResult, error) {
			return TestResult{Address: address}, nil
		},
		Workers:    1,
		BufferSize: 10,
		Monitor:    monitor,
	}

	err := p.Run(t.Context(), r, &buf)
	if err != nil {
		t.Fatalf("Run() error = %v", err)
	}

	if monitor.progress != 3 {
		t.Errorf("expected progress 3, got %d", monitor.progress)
	}
	if !monitor.completed {
		t.Error("expected CompleteTask to be called")
	}
}

func TestErrorResponse_JSON(t *testing.T) {
	resp := errorResponse{
		Error: "test error",
		Input: "test input",
	}

	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("Marshal error: %v", err)
	}

	var parsed errorResponse
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Unmarshal error: %v", err)
	}

	if parsed.Error != resp.Error {
		t.Errorf("Error mismatch: got %q, want %q", parsed.Error, resp.Error)
	}
	if parsed.Input != resp.Input {
		t.Errorf("Input mismatch: got %q, want %q", parsed.Input, resp.Input)
	}
}

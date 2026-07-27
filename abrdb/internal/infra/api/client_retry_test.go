package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

// newFastRetryClient returns a client whose backoff waits are recorded
// instead of slept and whose jitter is disabled, so retry tests run
// instantly and assert exact delays.
func newFastRetryClient(url string) (*Client, *[]time.Duration) {
	c := New(url)
	sleeps := &[]time.Duration{}
	c.sleep = func(_ context.Context, d time.Duration) error {
		*sleeps = append(*sleeps, d)
		return nil
	}
	c.jitter = func(d time.Duration) time.Duration { return d }
	return c, sleeps
}

func TestDownloadFile_RetriesOn5xxThenSucceeds(t *testing.T) {
	const body = "payload"
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch calls.Add(1) {
		case 1:
			w.WriteHeader(http.StatusInternalServerError)
		case 2:
			w.WriteHeader(http.StatusServiceUnavailable)
		default:
			_, _ = w.Write([]byte(body))
		}
	}))
	defer server.Close()

	client, sleeps := newFastRetryClient(server.URL)
	destPath := filepath.Join(t.TempDir(), "f.csv.zip")
	if err := client.DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}

	if got := calls.Load(); got != 3 {
		t.Errorf("HTTP calls = %d, want 3", got)
	}
	// Exponential backoff without jitter: 1s, then 2s.
	if want := []time.Duration{1 * time.Second, 2 * time.Second}; !slices.Equal(*sleeps, want) {
		t.Errorf("backoff waits = %v, want %v", *sleeps, want)
	}
	if data, err := os.ReadFile(destPath); err != nil || string(data) != body {
		t.Errorf("content = %q, err = %v, want %q", data, err, body)
	}
}

// TestDownloadFile_RetriesTruncatedBody pins that the retry unit is the whole
// attempt: a connection dropped mid-body (after a 200 status) is retried and
// the partial temp file does not survive.
func TestDownloadFile_RetriesTruncatedBody(t *testing.T) {
	const body = "full payload arrives on the second attempt"
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			// Declare more bytes than are sent: the client sees a 200, then
			// an unexpected EOF while copying the body.
			w.Header().Set("Content-Length", strconv.Itoa(len(body)*2))
			_, _ = w.Write([]byte(body[:5]))
			return
		}
		_, _ = w.Write([]byte(body))
	}))
	defer server.Close()

	client, sleeps := newFastRetryClient(server.URL)
	dir := t.TempDir()
	destPath := filepath.Join(dir, "f.csv.zip")
	if err := client.DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}

	if got := calls.Load(); got != 2 {
		t.Errorf("HTTP calls = %d, want 2", got)
	}
	if len(*sleeps) != 1 {
		t.Errorf("backoff waits = %v, want exactly one", *sleeps)
	}
	if data, err := os.ReadFile(destPath); err != nil || string(data) != body {
		t.Errorf("content = %q, err = %v, want %q", data, err, body)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("ReadDir: %v", err)
	}
	if len(entries) != 1 {
		t.Errorf("directory has %d entries, want only the final file (no temp leftovers)", len(entries))
	}
}

func TestDownloadFile_429HonorsRetryAfterSeconds(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.Header().Set("Retry-After", "7")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client, sleeps := newFastRetryClient(server.URL)
	destPath := filepath.Join(t.TempDir(), "f.csv.zip")
	if err := client.DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}
	if want := []time.Duration{7 * time.Second}; !slices.Equal(*sleeps, want) {
		t.Errorf("waits = %v, want %v (server-requested Retry-After)", *sleeps, want)
	}
}

func TestDownloadFile_RetryAfterHTTPDate(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.Header().Set("Retry-After", time.Now().Add(10*time.Second).UTC().Format(http.TimeFormat))
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client, sleeps := newFastRetryClient(server.URL)
	destPath := filepath.Join(t.TempDir(), "f.csv.zip")
	if err := client.DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}
	if len(*sleeps) != 1 {
		t.Fatalf("waits = %v, want exactly one", *sleeps)
	}
	// HTTP-date resolution is one second; allow for elapsed time between the
	// header being written and the delay being computed.
	if got := (*sleeps)[0]; got < 5*time.Second || got > 10*time.Second {
		t.Errorf("wait = %v, want within (5s, 10s] from the HTTP-date Retry-After", got)
	}
}

// TestDownloadFile_RetryAfterCapped pins the upper bound: a hostile or
// misconfigured Retry-After cannot stall the import beyond maxDelay.
func TestDownloadFile_RetryAfterCapped(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.Header().Set("Retry-After", "3600")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client, sleeps := newFastRetryClient(server.URL)
	destPath := filepath.Join(t.TempDir(), "f.csv.zip")
	if err := client.DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath); err != nil {
		t.Fatalf("DownloadFile: %v", err)
	}
	if want := []time.Duration{client.retry.maxDelay}; !slices.Equal(*sleeps, want) {
		t.Errorf("waits = %v, want %v (Retry-After capped at maxDelay)", *sleeps, want)
	}
}

func TestDownloadFile_ClientErrorFailsImmediately(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client, sleeps := newFastRetryClient(server.URL)
	destPath := filepath.Join(t.TempDir(), "f.csv.zip")
	err := client.DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath)
	if err == nil || !strings.Contains(err.Error(), "unexpected status code: 404") {
		t.Fatalf("err = %v, want unexpected status code: 404", err)
	}
	if got := calls.Load(); got != 1 {
		t.Errorf("HTTP calls = %d, want 1 (4xx other than 408/429 must not retry)", got)
	}
	if len(*sleeps) != 0 {
		t.Errorf("waits = %v, want none", *sleeps)
	}
}

// TestDownloadFile_ExhaustionIsPlainError pins the exit code contract: when
// retries run out, the failure is an ordinary error (exit 2 via the CLI
// mapping), never something that could be read as the dry-run "changes
// pending" result.
func TestDownloadFile_ExhaustionIsPlainError(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	client, sleeps := newFastRetryClient(server.URL)
	destPath := filepath.Join(t.TempDir(), "f.csv.zip")
	err := client.DownloadFile(t.Context(), server.URL+"/f.csv.zip", destPath)
	if err == nil {
		t.Fatal("want error after retry exhaustion")
	}
	if got := calls.Load(); got != 4 {
		t.Errorf("HTTP calls = %d, want 4 (1 attempt + 3 retries)", got)
	}
	if len(*sleeps) != 3 {
		t.Errorf("waits = %v, want 3", *sleeps)
	}
	// The CLI maps any error without an ExitCode method to exit 2; only
	// ChangesPendingError may exit 1.
	var exitCoder interface{ ExitCode() int }
	if errors.As(err, &exitCoder) {
		t.Errorf("err = %v carries ExitCode(); retry exhaustion must stay a plain error", err)
	}
}

// TestDownloadFile_BackoffAbortsOnCancel uses the real sleeper to pin that a
// backoff wait ends as soon as the context is canceled.
func TestDownloadFile_BackoffAbortsOnCancel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := New(server.URL)
	client.retry.baseDelay = 30 * time.Second // real sleeper: must be interrupted

	ctx, cancel := context.WithCancel(t.Context())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	start := time.Now()
	err := client.DownloadFile(ctx, server.URL+"/f.csv.zip", filepath.Join(t.TempDir(), "f.csv.zip"))
	if err == nil {
		t.Fatal("want error when canceled during backoff")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Errorf("DownloadFile returned after %v; backoff wait did not abort on cancel", elapsed)
	}
	// The cancellation must be identifiable by the caller; the aborted
	// attempt's error stays attached for diagnosis.
	if !errors.Is(err, context.Canceled) {
		t.Errorf("err = %v, want errors.Is(err, context.Canceled)", err)
	}
	if !strings.Contains(err.Error(), "unexpected status code: 500") {
		t.Errorf("err = %v, want the last attempt error attached", err)
	}
}

// TestFetchFeed_TimeoutSpansBackoff pins that the feed timeout covers the
// whole retry sequence, backoff waits included, not just a single request.
func TestFetchFeed_TimeoutSpansBackoff(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := New(server.URL)
	client.feedTimeout = 100 * time.Millisecond
	client.retry.baseDelay = 30 * time.Second // would exceed the timeout by itself

	start := time.Now()
	_, err := client.FetchFeed(t.Context())
	if err == nil {
		t.Fatal("want error when the feed timeout expires during backoff")
	}
	if elapsed := time.Since(start); elapsed > 5*time.Second {
		t.Errorf("FetchFeed returned after %v; feed timeout did not span the backoff wait", elapsed)
	}
	if got := calls.Load(); got != 1 {
		t.Errorf("HTTP calls = %d, want 1 (timeout hit during the first backoff)", got)
	}
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("err = %v, want errors.Is(err, context.DeadlineExceeded)", err)
	}
}

func TestFetchFeed_RetriesThenSucceeds(t *testing.T) {
	var calls atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			w.WriteHeader(http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"dataset":[]}`))
	}))
	defer server.Close()

	client, sleeps := newFastRetryClient(server.URL)
	feed, err := client.FetchFeed(t.Context())
	if err != nil {
		t.Fatalf("FetchFeed: %v", err)
	}
	if feed == nil || len(feed.Dataset) != 0 {
		t.Errorf("feed = %+v, want empty dataset", feed)
	}
	if got := calls.Load(); got != 2 {
		t.Errorf("HTTP calls = %d, want 2", got)
	}
	if len(*sleeps) != 1 {
		t.Errorf("waits = %v, want 1", *sleeps)
	}
}

func TestIsRetryable(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"500", &httpStatusError{status: 500}, true},
		{"502", &httpStatusError{status: 502}, true},
		{"429", &httpStatusError{status: 429}, true},
		{"408", &httpStatusError{status: 408}, true},
		{"400", &httpStatusError{status: 400}, false},
		{"403", &httpStatusError{status: 403}, false},
		{"404", &httpStatusError{status: 404}, false},
		// Transport-level failures are retryable.
		{"connection reset during read", &net.OpError{Op: "read", Err: syscall.ECONNRESET}, true},
		{"http.Client.Do failure", &url.Error{Op: "Get", URL: "https://x", Err: syscall.ECONNREFUSED}, true},
		{"dns error", &net.DNSError{Name: "x", Err: "no such host"}, true},
		{"body truncated against Content-Length", fmt.Errorf("write file: %w", io.ErrUnexpectedEOF), true},
		{"decoder-wrapped EOF", fmt.Errorf("decode feed: %w", io.EOF), true},
		// Local and permanent failures are not.
		{"disk full during write", &fs.PathError{Op: "write", Path: "/f.tmp", Err: syscall.ENOSPC}, false},
		{"rename failure", &os.LinkError{Op: "rename", Old: "/f.tmp", New: "/f", Err: syscall.EACCES}, false},
		{"malformed json", &json.SyntaxError{}, false},
		{"plain error", errors.New("something else"), false},
		{"context canceled", context.Canceled, false},
		{"deadline exceeded", context.DeadlineExceeded, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isRetryable(tt.err); got != tt.want {
				t.Errorf("isRetryable(%v) = %v, want %v", tt.err, got, tt.want)
			}
		})
	}
}

func TestParseRetryAfter(t *testing.T) {
	tests := []struct {
		name    string
		header  string
		wantMin time.Duration
		wantMax time.Duration
	}{
		{"empty", "", 0, 0},
		{"seconds", "12", 12 * time.Second, 12 * time.Second},
		{"negative seconds clamp to zero", "-3", 0, 0},
		{"garbage", "soon", 0, 0},
		{"http date in the future", time.Now().Add(10 * time.Second).UTC().Format(http.TimeFormat), 5 * time.Second, 10 * time.Second},
		{"http date in the past clamps to zero", time.Now().Add(-time.Hour).UTC().Format(http.TimeFormat), 0, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseRetryAfter(tt.header)
			if got < tt.wantMin || got > tt.wantMax {
				t.Errorf("parseRetryAfter(%q) = %v, want within [%v, %v]", tt.header, got, tt.wantMin, tt.wantMax)
			}
		})
	}
}

package command

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

// TestServeCmd_CancelledContext pins the clean-shutdown contract of the serve
// command: cancellation during initialization (here: before the cache open)
// exits without an error, while real initialization failures still surface.
func TestServeCmd_CancelledContext(t *testing.T) {
	const quickstartCachePath = "../../../../quickstart/tokyo_basic.duckdb"

	t.Run("cancellation during startup is a clean shutdown", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		cmd := NewServerCmd()
		cmd.SetArgs([]string{"--cache", quickstartCachePath})
		if err := cmd.ExecuteContext(ctx); err != nil {
			t.Fatalf("serve with cancelled context = %v, want nil", err)
		}
	})

	t.Run("real startup failures still surface", func(t *testing.T) {
		cmd := NewServerCmd()
		cmd.SetArgs([]string{"--cache", "/nonexistent/abrg.duckdb"})
		cmd.SilenceUsage = true
		cmd.SilenceErrors = true
		if err := cmd.ExecuteContext(t.Context()); err == nil {
			t.Fatal("serve with missing cache = nil, want error")
		}
	})
}

func TestRunHTTPServer_GracefulShutdownOnContextCancel(t *testing.T) {
	t.Parallel()

	ln, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := ln.Addr().String()
	_ = ln.Close()

	srv := &http.Server{
		Addr:              addr,
		Handler:           http.NewServeMux(),
		ReadHeaderTimeout: time.Second,
	}

	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- runHTTPServer(ctx, srv) }()

	// Wait until the server is accepting connections before triggering shutdown.
	deadline := time.Now().Add(2 * time.Second)
	for {
		conn, dialErr := (&net.Dialer{Timeout: 100 * time.Millisecond}).DialContext(t.Context(), "tcp", addr)
		if dialErr == nil {
			_ = conn.Close()
			break
		}
		if time.Now().After(deadline) {
			cancel()
			<-done
			t.Fatalf("server did not start within deadline: %v", dialErr)
		}
		time.Sleep(20 * time.Millisecond)
	}

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("runHTTPServer returned error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("runHTTPServer did not return within 5s after ctx cancel")
	}
}

func TestRunHTTPServer_ListenFailure(t *testing.T) {
	t.Parallel()

	ln, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer func() { _ = ln.Close() }()

	srv := &http.Server{
		Addr:              ln.Addr().String(),
		Handler:           http.NewServeMux(),
		ReadHeaderTimeout: time.Second,
	}

	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
	defer cancel()

	err = runHTTPServer(ctx, srv)
	if err == nil {
		t.Fatal("expected error when port is already in use")
	}
}

// syncBuffer collects the log output the server writes from its own goroutine.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

// TestRunHTTPServer_LogsTheAddressItAcceptsOn pins that the "server started"
// log names the address the server is listening on, and that it is accepting
// connections by the time that log is written. Clients use it to tell when the
// server is ready.
func TestRunHTTPServer_LogsTheAddressItAcceptsOn(t *testing.T) {
	var logs syncBuffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logs, nil)))
	defer slog.SetDefault(prev)

	srv := &http.Server{
		Addr:              "127.0.0.1:0",
		Handler:           http.NewServeMux(),
		ReadHeaderTimeout: time.Second,
	}

	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- runHTTPServer(ctx, srv) }()

	var addr string
	deadline := time.Now().Add(2 * time.Second)
	for addr == "" {
		if time.Now().After(deadline) {
			cancel()
			<-done
			t.Fatalf("no server_start log within deadline: %s", logs.String())
		}
		time.Sleep(20 * time.Millisecond)
		for line := range strings.SplitSeq(logs.String(), "\n") {
			var entry struct {
				Event string `json:"event"`
				Addr  string `json:"addr"`
			}
			if json.Unmarshal([]byte(line), &entry) == nil && entry.Event == "server_start" {
				addr = entry.Addr
			}
		}
	}

	if addr == srv.Addr {
		t.Errorf("logged addr = %q, want the address the listener resolved to", addr)
	}

	conn, err := (&net.Dialer{Timeout: time.Second}).DialContext(t.Context(), "tcp", addr)
	if err != nil {
		t.Errorf("dial %s after server_start: %v", addr, err)
	} else {
		_ = conn.Close()
	}

	cancel()
	if err := <-done; err != nil {
		t.Errorf("runHTTPServer returned error: %v", err)
	}
}

// TestRunHTTPServer_FreesThePortWhenCancelledAtStartup pins that the listener
// is closed by the time runHTTPServer returns, so restarting on the same port
// works. Shutdown alone does not close a listener that Serve has not
// registered yet.
func TestRunHTTPServer_FreesThePortWhenCancelledAtStartup(t *testing.T) {
	t.Parallel()

	ln, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	addr := ln.Addr().String()
	_ = ln.Close()

	srv := &http.Server{
		Addr:              addr,
		Handler:           http.NewServeMux(),
		ReadHeaderTimeout: time.Second,
	}

	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := runHTTPServer(ctx, srv); err != nil {
		t.Fatalf("runHTTPServer with a cancelled context = %v, want nil", err)
	}

	again, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", addr)
	if err != nil {
		t.Fatalf("listen on %s after runHTTPServer returned: %v", addr, err)
	}
	_ = again.Close()
}

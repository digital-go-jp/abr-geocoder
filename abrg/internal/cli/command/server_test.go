package command

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestServerInitError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		err     error
		wantNil bool
	}{
		{
			name:    "cancellation during initialization is a clean shutdown",
			err:     fmt.Errorf("check table existence: %w", context.Canceled),
			wantNil: true,
		},
		{
			name:    "other initialization errors are returned",
			err:     errors.New("catalog error"),
			wantNil: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := serverInitError(tt.err)
			if tt.wantNil {
				if got != nil {
					t.Fatalf("serverInitError() = %v, want nil", got)
				}
				return
			}
			if !errors.Is(got, tt.err) {
				t.Fatalf("serverInitError() = %v, want wrapped %v", got, tt.err)
			}
		})
	}
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

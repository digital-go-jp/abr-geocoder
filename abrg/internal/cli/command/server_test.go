package command

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"
)

func TestRunHTTPServer_GracefulShutdownOnContextCancel(t *testing.T) {
	t.Parallel()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
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
		conn, dialErr := net.DialTimeout("tcp", addr, 100*time.Millisecond)
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

	ln, err := net.Listen("tcp", "127.0.0.1:0")
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

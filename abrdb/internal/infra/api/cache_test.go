package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestFetchFeedCaching(t *testing.T) {
	var callCount atomic.Int32

	// Mock server that counts requests
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount.Add(1)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"@context":"test","@type":"dcat:Catalog","dataset":[]}`))
	}))
	defer server.Close()

	client := New(server.URL)
	ctx := context.Background()

	// Call FetchFeed multiple times
	for range 5 {
		_, err := client.FetchFeed(ctx)
		if err != nil {
			t.Fatalf("FetchFeed failed: %v", err)
		}
	}

	count := callCount.Load()
	if count != 1 {
		t.Errorf("Cache not working: FetchFeed called 5 times, but HTTP request made %d times (expected 1)", count)
	}
}

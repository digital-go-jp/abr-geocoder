package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"sync"
	"testing"

	"abrg/internal/cache"
	"abrg/internal/testutil"
)

// The tests in this file pin the route wiring of NewGinServer for the
// matcher-presence (cache set or nil) and EnabledPos combinations. The
// committed quickstart cache (Tokyo, basic category, pos enabled) provides a
// real cache so the matcher and reverse geocoder paths are constructed.
var initQuickstartCache = sync.OnceValues(func() (*cache.DuckDBCache, error) {
	return cache.NewDuckDBCacheFromPath(context.Background(), "../../../quickstart/tokyo_basic.duckdb")
})

func registeredPaths(s *GinServer) []string {
	var paths []string
	for _, route := range s.router.Routes() {
		if route.Method == http.MethodGet {
			paths = append(paths, route.Path)
		}
	}
	slices.Sort(paths)
	return paths
}

func serveRequest(t *testing.T, s *GinServer, target string) *httptest.ResponseRecorder {
	t.Helper()
	w := httptest.NewRecorder()
	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, target, nil)
	if err != nil {
		t.Fatalf("NewRequestWithContext(%q) error = %v", target, err)
	}
	s.Handler().ServeHTTP(w, req)
	return w
}

func TestNewGinServer_WithoutCache(t *testing.T) {
	for _, enabledPos := range []bool{false, true} {
		server, err := NewGinServer(ServerConfig{EnabledPos: enabledPos})
		if err != nil {
			t.Fatalf("NewGinServer() error = %v", err)
		}

		want := []string{"/", "/health", "/normalize"}
		if got := registeredPaths(server); !slices.Equal(got, want) {
			t.Errorf("EnabledPos=%v: registered paths = %v, want %v", enabledPos, got, want)
		}

		for _, target := range []string{"/match?address=東京都", "/geocode?address=東京都", "/reverse?lat=35.6&lon=139.7"} {
			if w := serveRequest(t, server, target); w.Code != http.StatusNotFound {
				t.Errorf("EnabledPos=%v: GET %s status = %d, want %d", enabledPos, target, w.Code, http.StatusNotFound)
			}
		}

		if w := serveRequest(t, server, "/health"); w.Code != http.StatusOK {
			t.Errorf("EnabledPos=%v: GET /health status = %d, want %d", enabledPos, w.Code, http.StatusOK)
		}
	}
}

func TestNewGinServer_WithCachePosEnabled(t *testing.T) {
	c := testutil.Setup(t, initQuickstartCache)

	server, err := NewGinServer(ServerConfig{
		EnabledPos: true, EnabledCategory: "basic", EnabledPref: "13", Cache: c,
	})
	if err != nil {
		t.Fatalf("NewGinServer() error = %v", err)
	}

	want := []string{"/", "/geocode", "/health", "/match", "/normalize", "/reverse"}
	if got := registeredPaths(server); !slices.Equal(got, want) {
		t.Errorf("registered paths = %v, want %v", got, want)
	}

	for _, target := range []string{
		"/match?address=東京都千代田区紀尾井町",
		"/geocode?address=東京都千代田区紀尾井町",
		"/reverse?lat=35.681412&lon=139.734955",
	} {
		if w := serveRequest(t, server, target); w.Code != http.StatusOK {
			t.Errorf("GET %s status = %d, want %d: %s", target, w.Code, http.StatusOK, w.Body.String())
		}
	}
}

func TestNewGinServer_WithCachePosDisabled(t *testing.T) {
	c := testutil.Setup(t, initQuickstartCache)

	server, err := NewGinServer(ServerConfig{
		EnabledPos: false, EnabledCategory: "basic", EnabledPref: "13", Cache: c,
	})
	if err != nil {
		t.Fatalf("NewGinServer() error = %v", err)
	}

	// The position endpoints stay registered but answer with the disabled response.
	want := []string{"/", "/geocode", "/health", "/match", "/normalize", "/reverse"}
	if got := registeredPaths(server); !slices.Equal(got, want) {
		t.Errorf("registered paths = %v, want %v", got, want)
	}

	for _, target := range []string{"/geocode?address=東京都", "/reverse?lat=35.6&lon=139.7"} {
		w := serveRequest(t, server, target)
		if w.Code != http.StatusServiceUnavailable {
			t.Errorf("GET %s status = %d, want %d", target, w.Code, http.StatusServiceUnavailable)
		}
		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("GET %s: unmarshal response: %v", target, err)
		}
		if body["status"] != "error" {
			t.Errorf("GET %s status field = %v, want error", target, body["status"])
		}
	}

	if w := serveRequest(t, server, "/match?address=東京都千代田区紀尾井町"); w.Code != http.StatusOK {
		t.Errorf("GET /match status = %d, want %d", w.Code, http.StatusOK)
	}
}

package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"

	"abrg/internal/cache"
)

// The tests in this file pin the route wiring of NewGinServer for the
// matcher-presence (cache set or nil) and EnabledPos combinations. The
// committed quickstart cache (Tokyo, basic category, pos enabled) provides a
// real cache so the matcher and reverse geocoder paths are constructed.
var initQuickstartCache = sync.OnceValues(func() (*cache.DuckDBCache, error) {
	return cache.NewDuckDBCacheFromPath(context.Background(), "../../../quickstart/tokyo_basic.duckdb")
})

// setupQuickstartCache opens the quickstart cache. The file is tracked in
// Git, so a failure to open it is a real regression and fails the test
// instead of skipping.
func setupQuickstartCache(t *testing.T) *cache.DuckDBCache {
	t.Helper()
	c, err := initQuickstartCache()
	if err != nil {
		t.Fatalf("open quickstart cache: %v", err)
	}
	return c
}

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
	for _, enabledPos := range []string{"false", "true"} {
		server := NewGinServer(ServerConfig{CacheConfig: cache.Config{EnabledPos: enabledPos}})

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

		// The component interface fields must stay untyped nil so that nil
		// checks keep working; a typed-nil *repository.DB would slip through.
		if server.repo != nil {
			t.Errorf("EnabledPos=%v: repo = %#v, want untyped nil", enabledPos, server.repo)
		}
		if server.matcher != nil {
			t.Errorf("EnabledPos=%v: matcher = %#v, want untyped nil", enabledPos, server.matcher)
		}
		if server.reverseGeocoder != nil {
			t.Errorf("EnabledPos=%v: reverseGeocoder = %#v, want untyped nil", enabledPos, server.reverseGeocoder)
		}
	}
}

func TestNewGinServer_WithCachePosEnabled(t *testing.T) {
	c := setupQuickstartCache(t)

	server := NewGinServer(ServerConfig{
		Cache:       c,
		CacheConfig: cache.Config{EnabledPos: "true", EnabledCategory: "basic", EnabledPref: "13"},
	})

	want := []string{"/", "/geocode", "/health", "/match", "/normalize", "/reverse"}
	if got := registeredPaths(server); !slices.Equal(got, want) {
		t.Errorf("registered paths = %v, want %v", got, want)
	}

	// Each endpoint is checked for its response-specific shape so that a
	// swapped handler cannot pass on status code alone.
	t.Run("match returns MatchResult features", func(t *testing.T) {
		w := serveRequest(t, server, "/match?address=東京都千代田区紀尾井町")
		body := decodeOKResponse(t, w, "application/json")
		if body["type"] != "MatchResult" {
			t.Errorf("type = %v, want MatchResult", body["type"])
		}
		feature := firstFeature(t, body)
		if addr, _ := feature["matched_address"].(string); addr == "" {
			t.Errorf("features[0].matched_address = %v, want non-empty", feature["matched_address"])
		}
		if _, ok := feature["geometry"]; ok {
			t.Error("features[0] has geometry, match features must not")
		}
	})

	t.Run("geocode returns GeoJSON with point geometry", func(t *testing.T) {
		w := serveRequest(t, server, "/geocode?address=東京都千代田区紀尾井町")
		body := decodeOKResponse(t, w, "application/geo+json")
		if body["type"] != "FeatureCollection" {
			t.Errorf("type = %v, want FeatureCollection", body["type"])
		}
		feature := firstFeature(t, body)
		if feature["type"] != "Feature" {
			t.Errorf("features[0].type = %v, want Feature", feature["type"])
		}
		geometry, _ := feature["geometry"].(map[string]any)
		if geometry == nil || geometry["type"] != "Point" {
			t.Fatalf("features[0].geometry = %v, want Point geometry", feature["geometry"])
		}
		if coords, _ := geometry["coordinates"].([]any); len(coords) != 2 {
			t.Errorf("geometry.coordinates = %v, want [lon lat]", geometry["coordinates"])
		}
	})

	t.Run("reverse returns GeoJSON with distance", func(t *testing.T) {
		w := serveRequest(t, server, "/reverse?lat=35.681412&lon=139.734955")
		body := decodeOKResponse(t, w, "application/geo+json")
		if body["type"] != "FeatureCollection" {
			t.Errorf("type = %v, want FeatureCollection", body["type"])
		}
		feature := firstFeature(t, body)
		properties, _ := feature["properties"].(map[string]any)
		if properties == nil {
			t.Fatalf("features[0].properties = %v, want object", feature["properties"])
		}
		if _, ok := properties["distance"]; !ok {
			t.Error("features[0].properties.distance missing, reverse features must carry it")
		}
	})

	// On this basic-category cache a request for residential/parcel data is
	// rejected by category validation (400). This is a separate path from the
	// reverse.ErrDataUnavailable 503 guard, which never fires through HTTP
	// because validation rejects the category first.
	t.Run("unloaded category is rejected with 400", func(t *testing.T) {
		for _, target := range []string{
			"/reverse?lat=35.681412&lon=139.734955&category=rsdtdsp",
			"/geocode?address=東京都千代田区紀尾井町&category=parcel",
		} {
			w := serveRequest(t, server, target)
			if w.Code != http.StatusBadRequest {
				t.Errorf("GET %s status = %d, want %d: %s", target, w.Code, http.StatusBadRequest, w.Body.String())
			}
		}
	})

	t.Run("normalize returns input and output", func(t *testing.T) {
		w := serveRequest(t, server, "/normalize?address=東京都千代田区紀尾井町１－３")
		body := decodeOKResponse(t, w, "application/json")
		if body["input"] != "東京都千代田区紀尾井町１－３" {
			t.Errorf("input = %v, want the request address", body["input"])
		}
		if out, _ := body["output"].(string); out == "" {
			t.Errorf("output = %v, want non-empty", body["output"])
		}
	})
}

// decodeOKResponse asserts a 200 response with the given content type prefix
// and decodes its JSON body.
func decodeOKResponse(t *testing.T, w *httptest.ResponseRecorder, contentType string) map[string]any {
	t.Helper()
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", w.Code, http.StatusOK, w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, contentType) {
		t.Errorf("Content-Type = %q, want prefix %q", ct, contentType)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	return body
}

// firstFeature returns features[0] of a decoded response body.
func firstFeature(t *testing.T, body map[string]any) map[string]any {
	t.Helper()
	features, _ := body["features"].([]any)
	if len(features) == 0 {
		t.Fatalf("features = %v, want at least one", body["features"])
	}
	feature, _ := features[0].(map[string]any)
	if feature == nil {
		t.Fatalf("features[0] = %v, want object", features[0])
	}
	return feature
}

func TestNewGinServer_WithCachePosDisabled(t *testing.T) {
	c := setupQuickstartCache(t)

	server := NewGinServer(ServerConfig{
		Cache:       c,
		CacheConfig: cache.Config{EnabledPos: "false", EnabledCategory: "basic", EnabledPref: "13"},
	})

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

// TestNewGinServer_ErrorResponsesAreJSON pins the JSON error contract for
// responses outside the registered routes: unknown paths, disallowed methods,
// and recovered panics.
func TestNewGinServer_ErrorResponsesAreJSON(t *testing.T) {
	server := NewGinServer(ServerConfig{})
	server.router.GET("/panic-test", func(*gin.Context) { panic("boom") })

	assertJSONError := func(t *testing.T, w *httptest.ResponseRecorder, wantCode int, wantMessage string) {
		t.Helper()
		if w.Code != wantCode {
			t.Errorf("status = %d, want %d", w.Code, wantCode)
		}
		if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
			t.Errorf("Content-Type = %q, want application/json", ct)
		}
		var body map[string]any
		if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
			t.Fatalf("unmarshal response %q: %v", w.Body.String(), err)
		}
		if body["status"] != "error" {
			t.Errorf("status field = %v, want error", body["status"])
		}
		if body["message"] != wantMessage {
			t.Errorf("message = %v, want %q", body["message"], wantMessage)
		}
	}

	serve := func(t *testing.T, method, target string) *httptest.ResponseRecorder {
		t.Helper()
		w := httptest.NewRecorder()
		req, err := http.NewRequestWithContext(t.Context(), method, target, nil)
		if err != nil {
			t.Fatalf("NewRequestWithContext(%q) error = %v", target, err)
		}
		server.Handler().ServeHTTP(w, req)
		return w
	}

	t.Run("unknown path returns JSON 404", func(t *testing.T) {
		assertJSONError(t, serve(t, http.MethodGet, "/no-such-route"), http.StatusNotFound, "not found")
	})

	t.Run("disallowed method returns JSON 405", func(t *testing.T) {
		assertJSONError(t, serve(t, http.MethodPost, "/health"), http.StatusMethodNotAllowed, "method not allowed")
	})

	t.Run("panic returns JSON 500", func(t *testing.T) {
		assertJSONError(t, serve(t, http.MethodGet, "/panic-test"), http.StatusInternalServerError, "Internal Server Error")
	})
}

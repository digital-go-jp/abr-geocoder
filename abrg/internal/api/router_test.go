package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/reverse"
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	os.Exit(m.Run())
}

// makeAddressString creates a test address string with exactly n Unicode characters.
func makeAddressString(n int) string {
	if n <= 0 {
		return ""
	}
	// Use single-width characters (ASCII) to keep URL encoding simple
	return strings.Repeat("あ", n)
}

// Mock implementations for testing handlers.

type mockMatcher struct {
	response *model.MatchResponse
	err      error
}

func (m *mockMatcher) Match(_ context.Context, _ model.MatchQuery) (*model.MatchResponse, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.response != nil {
		return m.response, nil
	}
	return &model.MatchResponse{}, nil
}

type mockReverseGeocoder struct {
	response *model.ReverseResponse
	err      error
}

func (m *mockReverseGeocoder) Reverse(_ context.Context, _ model.ReverseQuery) (*model.ReverseResponse, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.response != nil {
		return m.response, nil
	}
	return &model.ReverseResponse{}, nil
}

func TestGeocodeRequest_Validation(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantStatus int
		wantError  bool
	}{
		{
			name:       "valid request with all parameters",
			query:      "?address=東京都千代田区&category=all&limit=3",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name:       "valid request with minimal parameters",
			query:      "?address=東京都",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name:       "missing required address",
			query:      "?category=city",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "invalid category value",
			query:      "?address=東京都&category=invalid",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "limit out of range (6)",
			query:      "?address=東京都&limit=6",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "limit out of range (0)",
			query:      "?address=東京都&limit=0",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.GET("/test", func(c *gin.Context) {
				var req addressRequest
				if err := c.ShouldBindQuery(&req); err != nil {
					c.JSON(http.StatusBadRequest, errorResponse("Invalid request parameters"))
					return
				}
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequestWithContext(t.Context(), "GET", "/test"+tt.query, nil)
			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("GET /test%s status = %d, want %d", tt.query, w.Code, tt.wantStatus)
			}

			if tt.wantError {
				var response map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("GET /test%s failed to unmarshal response: %v", tt.query, err)
				}
				if response["status"] != "error" {
					t.Errorf("GET /test%s status = %v, want %q", tt.query, response["status"], "error")
				}
			}
		})
	}
}

func TestReverseRequest_Validation(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantStatus int
		wantError  bool
	}{
		{
			name:       "valid request with all parameters",
			query:      "?lat=35.6762&lon=139.6503&category=all&limit=3",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name:       "valid request with minimal parameters",
			query:      "?lat=35.6762&lon=139.6503",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name:       "missing required lat",
			query:      "?lon=139.6503",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "missing required lon",
			query:      "?lat=35.6762",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "lat out of range (-91)",
			query:      "?lat=-91&lon=139.6503",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "lat out of range (91)",
			query:      "?lat=91&lon=139.6503",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "lon out of range (-181)",
			query:      "?lat=35.6762&lon=-181",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "lon out of range (181)",
			query:      "?lat=35.6762&lon=181",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			// min=-90 is inclusive, so lat=-90 (with a non-zero lon) must be accepted.
			name:       "lat lower bound -90 is valid",
			query:      "?lat=-90&lon=139.6503",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			// max=90 is inclusive, so lat=90 must be accepted.
			name:       "lat upper bound 90 is valid",
			query:      "?lat=90&lon=139.6503",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name:       "lon lower bound -180 is valid",
			query:      "?lat=35.6762&lon=-180",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name:       "lon upper bound 180 is valid",
			query:      "?lat=35.6762&lon=180",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			// `required` treats the float64 zero value as missing, so lat=0 is
			// rejected. A point at lat=0/lon=0 is far outside Japan, so this is
			// acceptable for a Japan-only geocoder.
			name:       "lat=0 rejected as missing (required)",
			query:      "?lat=0&lon=139.6503",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "lon=0 rejected as missing (required)",
			query:      "?lat=35.6762&lon=0",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.GET("/test", func(c *gin.Context) {
				var req reverseRequest
				if err := c.ShouldBindQuery(&req); err != nil {
					c.JSON(http.StatusBadRequest, errorResponse("Invalid request parameters"))
					return
				}
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequestWithContext(t.Context(), "GET", "/test"+tt.query, nil)
			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("GET /test%s status = %d, want %d", tt.query, w.Code, tt.wantStatus)
			}

			if tt.wantError {
				var response map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("GET /test%s failed to unmarshal response: %v", tt.query, err)
				}
				if response["status"] != "error" {
					t.Errorf("GET /test%s status = %v, want %q", tt.query, response["status"], "error")
				}
			}
		})
	}
}

func TestMatchRequest_Validation(t *testing.T) {
	tests := []struct {
		name       string
		query      string
		wantStatus int
		wantError  bool
	}{
		{
			name:       "valid request with all parameters",
			query:      "?address=東京都千代田区1-1-1&category=rsdtdsp&pref=13&limit=3",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name:       "valid request with minimal parameters",
			query:      "?address=東京都千代田区",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
		{
			name:       "missing required address",
			query:      "?category=city",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "empty address",
			query:      "?address=",
			wantStatus: http.StatusBadRequest,
			wantError:  true,
		},
		{
			name:       "valid with all category types",
			query:      "?address=東京都&category=parcel",
			wantStatus: http.StatusOK,
			wantError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.GET("/test", func(c *gin.Context) {
				var req addressRequest
				if err := c.ShouldBindQuery(&req); err != nil {
					c.JSON(http.StatusBadRequest, errorResponse("Invalid request parameters"))
					return
				}
				c.JSON(http.StatusOK, gin.H{"status": "ok"})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequestWithContext(t.Context(), "GET", "/test"+tt.query, nil)
			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("GET /test%s status = %d, want %d", tt.query, w.Code, tt.wantStatus)
			}

			if tt.wantError {
				var response map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("GET /test%s failed to unmarshal response: %v", tt.query, err)
				}
				if response["status"] != "error" {
					t.Errorf("GET /test%s status = %v, want %q", tt.query, response["status"], "error")
				}
			}
		})
	}
}

func TestCategoryValues(t *testing.T) {
	validCategory := []string{"all", "basic", "rsdtdsp", "parcel"}

	for _, category := range validCategory {
		t.Run("valid_category_"+category, func(t *testing.T) {
			router := gin.New()
			router.GET("/test", func(c *gin.Context) {
				var req addressRequest
				if err := c.ShouldBindQuery(&req); err != nil {
					c.JSON(http.StatusBadRequest, errorResponse("Invalid request parameters"))
					return
				}
				c.JSON(http.StatusOK, gin.H{"status": "ok", "category": req.Category})
			})

			w := httptest.NewRecorder()
			req, _ := http.NewRequestWithContext(t.Context(), "GET", "/test?address=test&category="+category, nil)
			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("GET /test?address=test&category=%s status = %d, want %d", category, w.Code, http.StatusOK)
			}

			var response map[string]any
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				t.Fatalf("GET /test?address=test&category=%s failed to unmarshal response: %v", category, err)
			}
			if response["status"] != "ok" {
				t.Errorf("GET /test?address=test&category=%s status = %v, want %q", category, response["status"], "ok")
			}
			if response["category"] != category {
				t.Errorf("GET /test?address=test&category=%s category = %v, want %q", category, response["category"], category)
			}
		})
	}
}

// TestCategory and TestPref are now in abrg/internal/validate/params_test.go

// TestHealthHandler tests the health endpoint
func TestHealthHandler(t *testing.T) {
	server := &GinServer{}

	router := gin.New()
	router.GET("/health", server.HealthHandler)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("GET /health status = %d, want %d", w.Code, http.StatusOK)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("GET /health failed to unmarshal response: %v", err)
	}
	if response["status"] != "ok" {
		t.Errorf("GET /health status = %v, want %q", response["status"], "ok")
	}
}

// TestRootHandler tests the root endpoint
func TestRootHandler(t *testing.T) {
	server := &GinServer{apiVersion: "1.0.0"}

	router := gin.New()
	router.GET("/", server.RootHandler)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("GET / status = %d, want %d", w.Code, http.StatusOK)
	}

	var response struct {
		Name      string   `json:"name"`
		Version   string   `json:"version"`
		Endpoints []string `json:"endpoints"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("GET / failed to unmarshal response: %v", err)
	}
	if response.Name != "abrg" {
		t.Errorf("GET / name = %v, want %q", response.Name, "abrg")
	}
	if response.Version != "1.0.0" {
		t.Errorf("GET / version = %v, want %q", response.Version, "1.0.0")
	}
	// With nil components, only /, /health, /normalize should be available
	if !slices.Contains(response.Endpoints, "/") {
		t.Errorf("GET / endpoints should contain %q", "/")
	}
	if !slices.Contains(response.Endpoints, "/health") {
		t.Errorf("GET / endpoints should contain %q", "/health")
	}
	if !slices.Contains(response.Endpoints, "/normalize") {
		t.Errorf("GET / endpoints should contain %q", "/normalize")
	}
	if slices.Contains(response.Endpoints, "/match") {
		t.Errorf("GET / endpoints should not contain %q", "/match")
	}
	if slices.Contains(response.Endpoints, "/geocode") {
		t.Errorf("GET / endpoints should not contain %q", "/geocode")
	}
	if slices.Contains(response.Endpoints, "/reverse") {
		t.Errorf("GET / endpoints should not contain %q", "/reverse")
	}
}

// TestPositionDataDisabledHandler tests the position data disabled response
func TestPositionDataDisabledHandler(t *testing.T) {
	server := &GinServer{}

	router := gin.New()
	router.GET("/geocode", server.PositionDataDisabledHandler)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/geocode", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("GET /geocode status = %d, want %d", w.Code, http.StatusServiceUnavailable)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("GET /geocode failed to unmarshal response: %v", err)
	}
	if response["status"] != "error" {
		t.Errorf("GET /geocode status = %v, want %q", response["status"], "error")
	}
}

// TestErrorResponse tests the errorResponse helper
func TestErrorResponse(t *testing.T) {
	response := errorResponse("test error message")

	if response["status"] != "error" {
		t.Errorf("errorResponse() status = %v, want %q", response["status"], "error")
	}
	if response["message"] != "test error message" {
		t.Errorf("errorResponse() message = %v, want %q", response["message"], "test error message")
	}
}

// TestRegisterEndpoints pins how the endpoint spec table drives both route
// registration and the RootHandler endpoint listing.
func TestRegisterEndpoints(t *testing.T) {
	tests := []struct {
		name       string
		server     *GinServer
		wantPaths  []string // sorted registered GET paths
		wantListed []string // exact RootHandler endpoints order
	}{
		{
			name:       "no components - core routes only",
			server:     &GinServer{},
			wantPaths:  []string{"/", "/health", "/normalize"},
			wantListed: []string{"/", "/health", "/normalize"},
		},
		{
			name:       "all components, position enabled",
			server:     &GinServer{matcher: &mockMatcher{}, reverseGeocoder: &mockReverseGeocoder{}, enabledPos: true},
			wantPaths:  []string{"/", "/geocode", "/health", "/match", "/normalize", "/reverse"},
			wantListed: []string{"/", "/health", "/normalize", "/match", "/geocode", "/reverse"},
		},
		{
			name:       "all components, position disabled",
			server:     &GinServer{matcher: &mockMatcher{}, reverseGeocoder: &mockReverseGeocoder{}},
			wantPaths:  []string{"/", "/geocode", "/health", "/match", "/normalize", "/reverse"},
			wantListed: []string{"/", "/health", "/normalize", "/match"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			registerEndpoints(router, tt.server)

			var paths []string
			for _, r := range router.Routes() {
				if r.Method == http.MethodGet {
					paths = append(paths, r.Path)
				}
			}
			slices.Sort(paths)
			if !slices.Equal(paths, tt.wantPaths) {
				t.Errorf("registered paths = %v, want %v", paths, tt.wantPaths)
			}

			w := httptest.NewRecorder()
			req, _ := http.NewRequestWithContext(t.Context(), "GET", "/", nil)
			router.ServeHTTP(w, req)
			var root struct {
				Endpoints []string `json:"endpoints"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &root); err != nil {
				t.Fatalf("GET / failed to unmarshal response: %v", err)
			}
			if !slices.Equal(root.Endpoints, tt.wantListed) {
				t.Errorf("GET / endpoints = %v, want %v", root.Endpoints, tt.wantListed)
			}

			// Position endpoints answer with the disabled response when
			// registered but not listed.
			if tt.server.matcher != nil && !tt.server.enabledPos {
				w := httptest.NewRecorder()
				req, _ := http.NewRequestWithContext(t.Context(), "GET", "/geocode", nil)
				router.ServeHTTP(w, req)
				if w.Code != http.StatusServiceUnavailable {
					t.Errorf("GET /geocode status = %d, want %d", w.Code, http.StatusServiceUnavailable)
				}
			}
		})
	}
}

// TestValidateAddress tests the validateAddress helper function.
// Note: This overlaps with TestRequestValidation but tests the function directly.
func TestValidateAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		wantErr bool
	}{
		{"valid address", "東京都千代田区", false},
		{"valid with spaces", "東京都 千代田区", false},
		{"empty string", "", true},
		{"whitespace only", "   ", true},
		{"tab only", "\t\t", true},
		{"newline only", "\n", true},
		{"mixed whitespace", " \t\n ", true},
		// Note: strings.TrimSpace uses unicode.IsSpace, which includes U+3000 (ideographic space)
		{"fullwidth space only", "\u3000", true},
		{"address within max length (100 chars)", makeAddressString(100), false},
		{"address exceeds max length (101 chars)", makeAddressString(101), true},
		{"very long address (200 chars)", makeAddressString(200), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAddress(tt.address)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateAddress(%q) error = %v, wantErr %v", tt.address, err, tt.wantErr)
			}
			// Verify error message for whitespace-only validation (not length validation)
			if tt.wantErr && err != nil && len(tt.address) > 0 && len([]rune(tt.address)) <= MaxAddressLength {
				if err.Error() != "address cannot be empty or whitespace only" {
					t.Errorf("validateAddress(%q) error message = %q, want %q",
						tt.address, err.Error(), "address cannot be empty or whitespace only")
				}
			}
		})
	}
}

// TestSendBadRequest tests the sendBadRequest helper function.
func TestSendBadRequest(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		sendBadRequest(c, "test error message")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("sendBadRequest() status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("sendBadRequest() failed to unmarshal response: %v", err)
	}
	if response["status"] != "error" {
		t.Errorf("sendBadRequest() status = %v, want %q", response["status"], "error")
	}
	if response["message"] != "test error message" {
		t.Errorf("sendBadRequest() message = %v, want %q", response["message"], "test error message")
	}
}

// TestSendInternalServerError tests the sendInternalServerError helper function.
func TestSendInternalServerError(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		sendInternalServerError(c)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("sendInternalServerError() status = %d, want %d", w.Code, http.StatusInternalServerError)
	}

	var response map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("sendInternalServerError() failed to unmarshal response: %v", err)
	}
	if response["status"] != "error" {
		t.Errorf("sendInternalServerError() status = %v, want %q", response["status"], "error")
	}
	if response["message"] != "Internal Server Error" {
		t.Errorf("sendInternalServerError() message = %v, want %q", response["message"], "Internal Server Error")
	}
}

// TestValidateParams tests the GinServer.validateParams method.
func TestValidateParams(t *testing.T) {
	tests := []struct {
		name            string
		category        string
		pref            string
		enabledCategory string
		enabledPref     string
		wantCategory    model.Category
		wantPref        string
		wantErr         bool
	}{
		{
			name:            "valid all category with all category",
			category:        "all",
			pref:            "all",
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    model.CategoryAll,
			wantPref:        "all",
			wantErr:         false,
		},
		{
			name:            "valid basic category with specific prefecture",
			category:        "basic",
			pref:            "13",
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    model.CategoryBasic,
			wantPref:        "13",
			wantErr:         false,
		},
		{
			name:            "empty category defaults to enabledCategory",
			category:        "",
			pref:            "all",
			enabledCategory: "basic",
			enabledPref:     "all",
			wantCategory:    model.CategoryBasic,
			wantPref:        "all",
			wantErr:         false,
		},
		{
			name:            "invalid category",
			category:        "invalid",
			pref:            "all",
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    "",
			wantPref:        "",
			wantErr:         true,
		},
		{
			name:            "invalid pref",
			category:        "all",
			pref:            "99",
			enabledCategory: "all",
			enabledPref:     "all",
			wantCategory:    "",
			wantPref:        "",
			wantErr:         true,
		},
		{
			name:            "incompatible category with enabled category",
			category:        "rsdtdsp",
			pref:            "all",
			enabledCategory: "basic",
			enabledPref:     "all",
			wantCategory:    "",
			wantPref:        "",
			wantErr:         true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := &GinServer{
				enabledCategory: tt.enabledCategory,
				enabledPref:     tt.enabledPref,
			}
			gotCategory, gotPref, err := server.validateParams(tt.category, tt.pref)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateParams() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if gotCategory != tt.wantCategory {
					t.Errorf("validateParams() category = %v, want %v", gotCategory, tt.wantCategory)
				}
				if gotPref != tt.wantPref {
					t.Errorf("validateParams() pref = %v, want %v", gotPref, tt.wantPref)
				}
			}
		})
	}
}

// TestSetResultInfo tests the GinServer.setResultInfo method.
func TestSetResultInfo(t *testing.T) {
	server := &GinServer{
		apiVersion:      "1.2.3",
		dbVersion:       "2024.01.01",
		enabledCategory: "all",
		enabledPref:     "13",
	}

	info := &model.ResultInfo{}
	server.setResultInfo(info)

	if info.APIVersion != "1.2.3" {
		t.Errorf("setResultInfo() APIVersion = %v, want %v", info.APIVersion, "1.2.3")
	}
	if info.DBVersion != "2024.01.01" {
		t.Errorf("setResultInfo() DBVersion = %v, want %v", info.DBVersion, "2024.01.01")
	}
	if info.EnabledCategory != "all" {
		t.Errorf("setResultInfo() EnabledCategory = %v, want %v", info.EnabledCategory, "all")
	}
	if info.EnabledPref != "13" {
		t.Errorf("setResultInfo() EnabledPref = %v, want %v", info.EnabledPref, "13")
	}
}

// TestPrepareQuery tests the GinServer.prepareQuery method.
func TestPrepareQuery(t *testing.T) {
	tests := []struct {
		name         string
		address      string
		category     string
		pref         string
		wantOk       bool
		wantCategory model.Category
		wantPref     string
		wantStatus   int
	}{
		{
			name:         "valid request",
			address:      "東京都千代田区",
			category:     "all",
			pref:         "all",
			wantOk:       true,
			wantCategory: model.CategoryAll,
			wantPref:     "all",
		},
		{
			name:       "empty address",
			address:    "",
			category:   "all",
			pref:       "all",
			wantOk:     false,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "whitespace only address",
			address:    "   ",
			category:   "all",
			pref:       "all",
			wantOk:     false,
			wantStatus: http.StatusBadRequest,
		},
		{
			name:       "invalid category",
			address:    "東京都",
			category:   "invalid",
			pref:       "all",
			wantOk:     false,
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := &GinServer{
				enabledCategory: "all",
				enabledPref:     "all",
			}

			router := gin.New()
			var gotQuery model.MatchQuery
			var gotOk bool

			router.GET("/test", func(c *gin.Context) {
				gotQuery, gotOk = server.prepareQuery(
					c, tt.address, tt.category, tt.pref, 1)
				if gotOk {
					c.JSON(http.StatusOK, gin.H{"status": "ok"})
				}
			})

			w := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/test", nil)
			router.ServeHTTP(w, req)

			if gotOk != tt.wantOk {
				t.Errorf("prepareQuery() ok = %v, want %v", gotOk, tt.wantOk)
			}
			if tt.wantOk {
				if gotQuery.Category != tt.wantCategory {
					t.Errorf("prepareQuery() category = %v, want %v", gotQuery.Category, tt.wantCategory)
				}
				if gotQuery.Pref != tt.wantPref {
					t.Errorf("prepareQuery() pref = %v, want %v", gotQuery.Pref, tt.wantPref)
				}
			} else {
				if w.Code != tt.wantStatus {
					t.Errorf("prepareQuery() status = %v, want %v", w.Code, tt.wantStatus)
				}
			}
		})
	}
}

// TestConfigureCORS tests the configureCORS function.
// This test verifies that configureCORS does not panic and properly configures the router.
func TestConfigureCORS(t *testing.T) {
	t.Run("empty origin uses default CORS", func(t *testing.T) {
		router := gin.New()
		// Should not panic
		configureCORS(router, "")
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// Verify router works after configuring CORS
		w := httptest.NewRecorder()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/test", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("configureCORS() router should still work, got status %d", w.Code)
		}
	})

	t.Run("specific origin configured", func(t *testing.T) {
		router := gin.New()
		// Should not panic
		configureCORS(router, "http://allowed.example.com")
		router.GET("/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		// Verify router works after configuring CORS
		w := httptest.NewRecorder()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/test", nil)
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("configureCORS() router should still work, got status %d", w.Code)
		}
	})
}

// TestCategoryCompatible is now in abrg/internal/validate/params_test.go

// TestNormalizeHandler_Integration tests the NormalizeHandler (text normalization).
func TestNormalizeHandler_Integration(t *testing.T) {
	tests := []struct {
		name           string
		query          string
		wantStatus     int
		wantOutput     string
		wantErrorField bool
	}{
		{
			name:       "valid address",
			query:      "?address=東京都千代田区紀尾井町1番3号",
			wantStatus: http.StatusOK,
			wantOutput: "東京都千代田区紀尾井町1-3",
		},
		{
			name:           "missing address parameter",
			query:          "",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "empty address",
			query:          "?address=",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "whitespace only address",
			query:          "?address=%20%20%20",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := &GinServer{}

			router := gin.New()
			router.GET("/normalize", server.NormalizeHandler)

			w := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/normalize"+tt.query, nil)
			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("NormalizeHandler() status = %d, want %d", w.Code, tt.wantStatus)
			}

			if tt.wantErrorField {
				var response map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("NormalizeHandler() failed to unmarshal response: %v", err)
				}
				if response["status"] != "error" {
					t.Errorf("NormalizeHandler() status field = %v, want %q", response["status"], "error")
				}
			} else if tt.wantOutput != "" {
				var response model.NormalizeResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("NormalizeHandler() failed to unmarshal response: %v", err)
				}
				if response.Output != tt.wantOutput {
					t.Errorf("NormalizeHandler() output = %q, want %q", response.Output, tt.wantOutput)
				}
			}
		})
	}
}

// TestRootHandler_FullInfo tests RootHandler with all fields populated.
func TestRootHandler_FullInfo(t *testing.T) {
	tests := []struct {
		name               string
		apiVersion         string
		dbVersion          string
		enabledCategory    string
		enabledPref        string
		enabledPos         bool
		hasMatcher         bool
		hasReverseGeocoder bool
		wantEndpointCount  int
	}{
		{
			name:               "all components enabled",
			apiVersion:         "1.2.3",
			dbVersion:          "2024.01.01",
			enabledCategory:    "all",
			enabledPref:        "all",
			enabledPos:         true,
			hasMatcher:         true,
			hasReverseGeocoder: true,
			wantEndpointCount:  6, // /, /health, /normalize, /match, /geocode, /reverse
		},
		{
			name:               "only normalize",
			apiVersion:         "2.0.0",
			dbVersion:          "2025.01.01",
			enabledCategory:    "basic",
			enabledPref:        "13",
			hasMatcher:         false,
			hasReverseGeocoder: false,
			wantEndpointCount:  3, // /, /health, /normalize
		},
		{
			name:               "matcher only",
			apiVersion:         "3.0.0",
			dbVersion:          "",
			enabledCategory:    "rsdtdsp",
			enabledPref:        "all",
			enabledPos:         true,
			hasMatcher:         true,
			hasReverseGeocoder: false,
			wantEndpointCount:  5, // /, /health, /normalize, /match, /geocode
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := &GinServer{
				apiVersion:      tt.apiVersion,
				dbVersion:       tt.dbVersion,
				enabledCategory: tt.enabledCategory,
				enabledPref:     tt.enabledPref,
				enabledPos:      tt.enabledPos,
			}
			if tt.hasMatcher {
				server.matcher = &mockMatcher{}
			}
			if tt.hasReverseGeocoder {
				server.reverseGeocoder = &mockReverseGeocoder{}
			}

			router := gin.New()
			router.GET("/", server.RootHandler)

			w := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", nil)
			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("RootHandler() status = %d, want %d", w.Code, http.StatusOK)
			}

			var response struct {
				Name            string   `json:"name"`
				Version         string   `json:"version"`
				DBVersion       string   `json:"db_version"`
				EnabledCategory string   `json:"enabled_category"`
				EnabledPref     string   `json:"enabled_pref"`
				Endpoints       []string `json:"endpoints"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
				t.Fatalf("RootHandler() failed to unmarshal response: %v", err)
			}

			if response.Version != tt.apiVersion {
				t.Errorf("RootHandler() version = %q, want %q", response.Version, tt.apiVersion)
			}
			if response.DBVersion != tt.dbVersion {
				t.Errorf("RootHandler() db_version = %q, want %q", response.DBVersion, tt.dbVersion)
			}
			if response.EnabledCategory != tt.enabledCategory {
				t.Errorf("RootHandler() enabled_category = %q, want %q", response.EnabledCategory, tt.enabledCategory)
			}
			if response.EnabledPref != tt.enabledPref {
				t.Errorf("RootHandler() enabled_pref = %q, want %q", response.EnabledPref, tt.enabledPref)
			}
			if len(response.Endpoints) != tt.wantEndpointCount {
				t.Errorf("RootHandler() endpoint count = %d, want %d, endpoints: %v", len(response.Endpoints), tt.wantEndpointCount, response.Endpoints)
			}
		})
	}
}

// TestGeocodeHandler_Integration tests the GeocodeHandler with a mock normalizer.
func TestGeocodeHandler_Integration(t *testing.T) {
	tests := []struct {
		name           string
		query          string
		mockResponse   *model.MatchResponse
		mockErr        error
		wantStatus     int
		wantErrorField bool
	}{
		{
			name:  "valid address",
			query: "?address=東京都千代田区&category=all",
			mockResponse: &model.MatchResponse{
				Type: "MatchResult",
			},
			wantStatus: http.StatusOK,
		},
		{
			name:           "missing address parameter",
			query:          "?category=all",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "invalid category",
			query:          "?address=東京都&category=invalid",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "normalizer error",
			query:          "?address=東京都&category=all",
			mockErr:        errors.New("geocode failed"),
			wantStatus:     http.StatusInternalServerError,
			wantErrorField: true,
		},
		{
			name:           "data unavailable maps to 503",
			query:          "?address=東京都&category=all",
			mockErr:        fmt.Errorf("residential %w", matching.ErrDataUnavailable),
			wantStatus:     http.StatusServiceUnavailable,
			wantErrorField: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := &GinServer{
				matcher: &mockMatcher{
					response: tt.mockResponse,
					err:      tt.mockErr,
				},
				enabledCategory: "all",
				enabledPref:     "all",
			}

			router := gin.New()
			router.GET("/geocode", server.GeocodeHandler)

			w := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/geocode"+tt.query, nil)
			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("GeocodeHandler() status = %d, want %d", w.Code, tt.wantStatus)
			}

			if tt.wantErrorField {
				var response map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("GeocodeHandler() failed to unmarshal response: %v", err)
				}
				if response["status"] != "error" {
					t.Errorf("GeocodeHandler() status field = %v, want %q", response["status"], "error")
				}
			}
		})
	}
}

// TestMatchHandler_Integration tests the MatchHandler with a mock normalizer.
func TestMatchHandler_Integration(t *testing.T) {
	tests := []struct {
		name           string
		query          string
		mockResponse   *model.MatchResponse
		mockErr        error
		wantStatus     int
		wantErrorField bool
	}{
		{
			name:  "valid address",
			query: "?address=東京都千代田区&category=all",
			mockResponse: &model.MatchResponse{
				Type: "MatchResult",
			},
			wantStatus: http.StatusOK,
		},
		{
			name:           "missing address parameter",
			query:          "?category=all",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "empty address",
			query:          "?address=&category=all",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "normalizer error",
			query:          "?address=東京都&category=all",
			mockErr:        errors.New("normalize failed"),
			wantStatus:     http.StatusInternalServerError,
			wantErrorField: true,
		},
		{
			name:           "data unavailable maps to 503",
			query:          "?address=東京都&category=all",
			mockErr:        fmt.Errorf("parcel %w", matching.ErrDataUnavailable),
			wantStatus:     http.StatusServiceUnavailable,
			wantErrorField: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockNorm := &mockMatcher{
				response: tt.mockResponse,
				err:      tt.mockErr,
			}
			server := &GinServer{
				matcher:         mockNorm,
				enabledCategory: "all",
				enabledPref:     "all",
			}

			router := gin.New()
			router.GET("/match", server.MatchHandler)

			w := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/match"+tt.query, nil)
			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("MatchHandler() status = %d, want %d", w.Code, tt.wantStatus)
			}

			if tt.wantErrorField {
				var response map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("MatchHandler() failed to unmarshal response: %v", err)
				}
				if response["status"] != "error" {
					t.Errorf("MatchHandler() status field = %v, want %q", response["status"], "error")
				}
			}
		})
	}
}

// TestReverseHandler_Integration tests the ReverseHandler with a mock reverse geocoder.
func TestReverseHandler_Integration(t *testing.T) {
	tests := []struct {
		name           string
		query          string
		mockResponse   *model.ReverseResponse
		mockErr        error
		wantStatus     int
		wantErrorField bool
		wantMessage    string
	}{
		{
			name:  "valid coordinates",
			query: "?lat=35.6762&lon=139.6503&category=all",
			mockResponse: &model.ReverseResponse{
				Type: "FeatureCollection",
			},
			wantStatus: http.StatusOK,
		},
		{
			name:           "missing lat",
			query:          "?lon=139.6503&category=all",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "missing lon",
			query:          "?lat=35.6762&category=all",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "invalid category",
			query:          "?lat=35.6762&lon=139.6503&category=invalid",
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
		},
		{
			name:           "reverse geocoder error",
			query:          "?lat=35.6762&lon=139.6503&category=all",
			mockErr:        errors.New("reverse failed"),
			wantStatus:     http.StatusInternalServerError,
			wantErrorField: true,
		},
		{
			// Requested category data missing from the cache is a service
			// configuration issue, not a server fault: 503.
			name:           "data unavailable maps to 503",
			query:          "?lat=35.6762&lon=139.6503&category=parcel",
			mockErr:        fmt.Errorf("parcel %w", reverse.ErrDataUnavailable),
			wantStatus:     http.StatusServiceUnavailable,
			wantErrorField: true,
			wantMessage:    "parcel data not available in current cache",
		},
		{
			// A category the reverse geocoder does not recognize is a client
			// error: 400.
			name:           "unknown category maps to 400",
			query:          "?lat=35.6762&lon=139.6503&category=all",
			mockErr:        fmt.Errorf("%w: bogus", reverse.ErrUnknownCategory),
			wantStatus:     http.StatusBadRequest,
			wantErrorField: true,
			wantMessage:    "unknown category: bogus",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockRev := &mockReverseGeocoder{
				response: tt.mockResponse,
				err:      tt.mockErr,
			}
			server := &GinServer{
				reverseGeocoder: mockRev,
				enabledCategory: "all",
				enabledPref:     "all",
			}

			router := gin.New()
			router.GET("/reverse", server.ReverseHandler)

			w := httptest.NewRecorder()
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/reverse"+tt.query, nil)
			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("ReverseHandler() status = %d, want %d", w.Code, tt.wantStatus)
			}

			if tt.wantErrorField {
				var response map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("ReverseHandler() failed to unmarshal response: %v", err)
				}
				if response["status"] != "error" {
					t.Errorf("ReverseHandler() status field = %v, want %q", response["status"], "error")
				}
				if tt.wantMessage != "" && response["message"] != tt.wantMessage {
					t.Errorf("ReverseHandler() message = %v, want %q", response["message"], tt.wantMessage)
				}
			}
		})
	}
}

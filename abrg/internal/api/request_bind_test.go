package api

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestFormatBindError_UsesFormTagNames pins that binding error messages name
// fields by their query parameter name (form tag), not the Go struct field
// name: clients sent "address", so the 400 message must say "address".
func TestFormatBindError_UsesFormTagNames(t *testing.T) {
	registerFormTagNames()

	tests := []struct {
		name  string
		query string
		bind  func(c *gin.Context) error
		want  string
	}{
		{
			name:  "missing address",
			query: "/x",
			bind: func(c *gin.Context) error {
				var req addressRequest
				return c.ShouldBindQuery(&req)
			},
			want: "invalid parameters: address: required",
		},
		{
			name:  "limit out of range",
			query: "/x?address=a&limit=9",
			bind: func(c *gin.Context) error {
				var req addressRequest
				return c.ShouldBindQuery(&req)
			},
			want: "invalid parameters: limit: max",
		},
		{
			name:  "lat out of range",
			query: "/x?lat=99&lon=10",
			bind: func(c *gin.Context) error {
				var req reverseRequest
				return c.ShouldBindQuery(&req)
			},
			want: "invalid parameters: lat: max",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequestWithContext(t.Context(), "GET", tt.query, nil)

			err := tt.bind(c)
			if err == nil {
				t.Fatal("ShouldBindQuery: want error, got nil")
			}
			if got := formatBindError(err); got != tt.want {
				t.Errorf("formatBindError() = %q, want %q", got, tt.want)
			}
		})
	}
}

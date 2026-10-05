package api

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/model"
	"github.com/digital-go-jp/abr-geocoder/abrg/internal/validate"
)

// baseRequest contains common fields for all requests.
// validate.ValidateOptions checks their values, as it does for the CLI.
type baseRequest struct {
	Category string `form:"category"`
	Pref     string `form:"pref"`
	Limit    int    `form:"limit,default=1"`
}

// addressRequest represents address-based (match/geocode) request parameters.
type addressRequest struct {
	baseRequest
	Address string `form:"address" binding:"required"`
}

// reverseRequest represents reverse geocoding request parameters.
// Lat and Lon are strings because binding reads an empty number as 0.
// parseCoordinate converts them, and reverse.Reverse checks their range.
type reverseRequest struct {
	baseRequest
	Lat string `form:"lat" binding:"required"`
	Lon string `form:"lon" binding:"required"`
}

// parseCoordinate parses the lat or lon parameter named name.
func parseCoordinate(name, value string) (float64, error) {
	v, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return 0, fmt.Errorf("invalid %s: %q", name, value)
	}
	return v, nil
}

// normalizeRequest represents address standardization request parameters.
type normalizeRequest struct {
	Address string `form:"address" binding:"required"`
}

// validateOptions checks the request options against the cache configuration.
func (s *GinServer) validateOptions(req baseRequest) (model.Category, string, error) {
	return validate.ValidateOptions(req.Category, req.Pref, req.Limit, s.enabledCategory, s.enabledPref)
}

func errorResponse(message string) gin.H {
	return gin.H{"status": "error", "message": message}
}

var registerFormTagNamesOnce sync.Once

// registerFormTagNames makes validator errors name fields by their form tag,
// so 400 messages refer to the query parameter clients actually send
// (address) instead of the Go struct field (Address). The registration is on
// gin's process-wide binding engine, hence the once guard.
func registerFormTagNames() {
	registerFormTagNamesOnce.Do(func() {
		v, ok := binding.Validator.Engine().(*validator.Validate)
		if !ok {
			return
		}
		v.RegisterTagNameFunc(func(fld reflect.StructField) string {
			name, _, _ := strings.Cut(fld.Tag.Get("form"), ",")
			if name == "" || name == "-" {
				return fld.Name
			}
			return name
		})
	})
}

// formatBindError extracts field-level details from Gin binding errors.
func formatBindError(err error) string {
	if ve, ok := errors.AsType[validator.ValidationErrors](err); ok {
		msgs := make([]string, 0, len(ve))
		for _, fe := range ve {
			msgs = append(msgs, fmt.Sprintf("%s: %s", fe.Field(), fe.Tag()))
		}
		return "invalid parameters: " + strings.Join(msgs, ", ")
	}
	return "invalid request parameters"
}

// sendBadRequest responds with 400 Bad Request.
func sendBadRequest(c *gin.Context, message string) {
	c.JSON(http.StatusBadRequest, errorResponse(message))
}

// sendServiceUnavailable responds with 503 Service Unavailable.
func sendServiceUnavailable(c *gin.Context, message string) {
	c.JSON(http.StatusServiceUnavailable, errorResponse(message))
}

// sendInternalServerError responds with 500 Internal Server Error.
func sendInternalServerError(c *gin.Context) {
	c.JSON(http.StatusInternalServerError, errorResponse("Internal Server Error"))
}

// setResultInfo sets common result fields.
func (s *GinServer) setResultInfo(info *model.ResultInfo) {
	info.SetMeta(s.apiVersion, s.dbVersion, s.enabledCategory, s.enabledPref)
}

// sendGeoJSON responds with a GeoJSON response (sets Content-Type header).
func sendGeoJSON(c *gin.Context, data any) {
	c.Header("Content-Type", "application/geo+json; charset=utf-8")
	c.JSON(http.StatusOK, data)
}

// prepareQuery validates the request options, records them for structured
// logging, and builds the shared MatchQuery. It returns ok=false after writing
// an error response when validation fails.
// The matcher validates the address itself.
func (s *GinServer) prepareQuery(c *gin.Context, req addressRequest) (model.MatchQuery, bool) {
	category, pref, err := s.validateOptions(req.baseRequest)
	if err != nil {
		sendBadRequest(c, err.Error())
		return model.MatchQuery{}, false
	}

	c.Set(ctxKeyAddress, req.Address)
	c.Set(ctxKeyCategory, string(category))
	c.Set(ctxKeyPref, pref)

	return model.MatchQuery{
		Address:  req.Address,
		Category: category,
		Limit:    req.Limit,
		Pref:     pref,
	}, true
}

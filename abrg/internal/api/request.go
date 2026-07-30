package api

import (
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"

	"abrg/internal/model"
	"abrg/internal/validate"
)

// baseRequest contains common fields for all requests. The category list and
// the limit range restate model.Categories and validate.MinLimit/MaxLimit,
// because binding tags must be literals; binding_tags_test.go fails if they
// drift apart.
type baseRequest struct {
	Category string `form:"category" binding:"omitempty,oneof=all basic rsdtdsp parcel"`
	Pref     string `form:"pref" binding:"omitempty"`
	Limit    int    `form:"limit,default=1" binding:"min=1,max=5"`
}

// addressRequest represents address-based (match/geocode) request parameters.
type addressRequest struct {
	baseRequest
	Address string `form:"address" binding:"required"`
}

// reverseRequest represents reverse geocoding request parameters.
type reverseRequest struct {
	baseRequest
	Lat float64 `form:"lat" binding:"required,min=-90,max=90"`
	Lon float64 `form:"lon" binding:"required,min=-180,max=180"`
}

// normalizeRequest represents address standardization request parameters.
type normalizeRequest struct {
	Address string `form:"address" binding:"required"`
}

const MaxAddressLength = 100

// validateAddress checks if address is not empty or whitespace only, and not too long.
func validateAddress(address string) error {
	if strings.TrimSpace(address) == "" {
		return errors.New("address cannot be empty or whitespace only")
	}
	if len([]rune(address)) > MaxAddressLength {
		return fmt.Errorf("address too long: max %d characters", MaxAddressLength)
	}
	return nil
}

// validateParams validates category and pref parameters.
func (s *GinServer) validateParams(category, pref string) (model.Category, string, error) {
	validatedCategory, err := validate.ValidateCategory(category, s.enabledCategory)
	if err != nil {
		return "", "", err
	}

	validatedPref, err := validate.ValidatePref(pref, s.enabledPref)
	if err != nil {
		return "", "", err
	}

	return validatedCategory, validatedPref, nil
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

// prepareQuery validates the request params, records them for structured
// logging, and builds the shared MatchQuery. It returns ok=false after writing
// an error response when validation fails.
func (s *GinServer) prepareQuery(c *gin.Context, address, categoryStr, prefStr string, limit int) (model.MatchQuery, bool) {
	if err := validateAddress(address); err != nil {
		sendBadRequest(c, err.Error())
		return model.MatchQuery{}, false
	}

	category, pref, err := s.validateParams(categoryStr, prefStr)
	if err != nil {
		sendBadRequest(c, err.Error())
		return model.MatchQuery{}, false
	}

	c.Set(ctxKeyAddress, address)
	c.Set(ctxKeyCategory, string(category))
	c.Set(ctxKeyPref, pref)

	return model.MatchQuery{
		Address:  address,
		Category: category,
		Limit:    limit,
		Pref:     pref,
	}, true
}

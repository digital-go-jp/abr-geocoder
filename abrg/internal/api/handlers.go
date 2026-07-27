package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/normalize"
	"abrg/internal/reverse"
)

// logHandlerError logs a failed handler request with its parameters.
func logHandlerError(msg, event string, err error, params ...any) {
	args := make([]any, 0, len(params)+4)
	args = append(args, "event", event)
	args = append(args, params...)
	args = append(args, "error", err)
	slog.Error(msg, args...)
}

// queryLogParams returns the shared log parameters for an address query.
func queryLogParams(q model.MatchQuery) []any {
	return []any{"address", q.Address, "pref", q.Pref, "category", q.Category, "limit", q.Limit}
}

// sendMatchQueryError maps a match/geocode pipeline error to its response:
// data missing from the cache is 503, anything else is logged and answered
// with 500.
func sendMatchQueryError(c *gin.Context, msg, event string, err error, query model.MatchQuery) {
	if errors.Is(err, matching.ErrDataUnavailable) {
		c.JSON(http.StatusServiceUnavailable, errorResponse(err.Error()))
		return
	}
	logHandlerError(msg, event, err, queryLogParams(query)...)
	sendInternalServerError(c)
}

// setMatchLevelLog records the top feature's match level for access logging.
func setMatchLevelLog(c *gin.Context, level model.MatchLevel) {
	c.Set(ctxKeyMatchLevel, string(level))
}

func (s *GinServer) GeocodeHandler(c *gin.Context) {
	var req addressRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		sendBadRequest(c, formatBindError(err))
		return
	}

	query, ok := s.prepareQuery(c, req.Address, req.Category, req.Pref, req.Limit)
	if !ok {
		return
	}

	result, err := matching.Geocode(c.Request.Context(), s.matcher, s.repo, query)
	if err != nil {
		sendMatchQueryError(c, "geocode request failed", "geocode", err, query)
		return
	}

	// Set result params for structured logging
	if len(result.Features) > 0 {
		setMatchLevelLog(c, result.Features[0].Properties.MatchLevel)
		if cl := result.Features[0].Properties.CoordinatesLevel; cl != nil {
			c.Set(ctxKeyCoordLevel, string(*cl))
		}
	}

	s.setResultInfo(&result.ResultInfo)
	sendGeoJSON(c, result)
}

func (s *GinServer) ReverseHandler(c *gin.Context) {
	var req reverseRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		sendBadRequest(c, formatBindError(err))
		return
	}

	category, pref, err := s.validateParams(req.Category, req.Pref)
	if err != nil {
		sendBadRequest(c, err.Error())
		return
	}

	// Set request params for structured logging
	c.Set(ctxKeyLat, req.Lat)
	c.Set(ctxKeyLon, req.Lon)
	c.Set(ctxKeyCategory, string(category))
	c.Set(ctxKeyPref, pref)

	result, err := s.reverseGeocoder.Reverse(c.Request.Context(), model.ReverseQuery{
		Lon:      req.Lon,
		Lat:      req.Lat,
		Category: category,
		Limit:    req.Limit,
		Pref:     pref,
	})
	if err != nil {
		switch {
		case errors.Is(err, reverse.ErrUnknownCategory):
			sendBadRequest(c, err.Error())
		case errors.Is(err, reverse.ErrDataUnavailable):
			c.JSON(http.StatusServiceUnavailable, errorResponse(err.Error()))
		default:
			logHandlerError("reverse geocode request failed", "reverse", err,
				"lon", req.Lon, "lat", req.Lat, "pref", pref, "category", category, "limit", req.Limit)
			sendInternalServerError(c)
		}
		return
	}

	// Set result params for structured logging
	if len(result.Features) > 0 {
		setMatchLevelLog(c, result.Features[0].Properties.MatchLevel)
		c.Set(ctxKeyDistance, result.Features[0].Properties.Distance)
	}

	s.setResultInfo(&result.ResultInfo)
	sendGeoJSON(c, result)
}

func (s *GinServer) MatchHandler(c *gin.Context) {
	var req addressRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		sendBadRequest(c, formatBindError(err))
		return
	}

	query, ok := s.prepareQuery(c, req.Address, req.Category, req.Pref, req.Limit)
	if !ok {
		return
	}

	result, err := s.matcher.Match(c.Request.Context(), query)
	if err != nil {
		sendMatchQueryError(c, "match request failed", "match", err, query)
		return
	}

	// Set result params for structured logging
	if len(result.Features) > 0 {
		setMatchLevelLog(c, result.Features[0].MatchLevel)
	}

	s.setResultInfo(&result.ResultInfo)
	c.JSON(http.StatusOK, result)
}

func (s *GinServer) NormalizeHandler(c *gin.Context) {
	var req normalizeRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		sendBadRequest(c, formatBindError(err))
		return
	}

	if err := validateAddress(req.Address); err != nil {
		sendBadRequest(c, err.Error())
		return
	}

	output, addressType := normalize.NormalizeAddressText(req.Address)
	c.JSON(http.StatusOK, model.NormalizeResponse{
		Input:  req.Address,
		Output: output,
		Type:   addressType,
	})
}

func (s *GinServer) HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

func (s *GinServer) RootHandler(c *gin.Context) {
	endpoints := make([]string, 0, len(endpointSpecs()))
	for _, spec := range endpointSpecs() {
		if spec.available(s) {
			endpoints = append(endpoints, spec.path)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"name":             "abrg",
		"version":          s.apiVersion,
		"db_version":       s.dbVersion,
		"enabled_category": s.enabledCategory,
		"enabled_pref":     s.enabledPref,
		"endpoints":        endpoints,
	})
}

func (s *GinServer) PositionDataDisabledHandler(c *gin.Context) {
	c.JSON(http.StatusServiceUnavailable, errorResponse("This endpoint requires enable_pos=true in the database."))
}

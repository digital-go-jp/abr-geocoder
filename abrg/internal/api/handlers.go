package api

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/normalize"
)

func (s *GinServer) GeocodeHandler(c *gin.Context) {
	var req geocodeRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		sendBadRequest(c, formatBindError(err))
		return
	}

	category, pref, limit, ok := s.handleAddressRequest(c, req.Address, req.Category, req.Pref, req.Limit)
	if !ok {
		return
	}

	// Set request params for structured logging
	c.Set(ctxKeyAddress, req.Address)
	c.Set(ctxKeyCategory, string(category))
	c.Set(ctxKeyPref, pref)

	result, err := matching.Geocode(c.Request.Context(), s.matcher, s.repo, model.MatchQuery{
		Address:  req.Address,
		Category: category,
		Limit:    limit,
		Pref:     pref,
	})
	if err != nil {
		slog.Error("geocode request failed", "event", "geocode", "address", req.Address, "pref", pref, "category", category, "limit", limit, "error", err)
		sendInternalServerError(c)
		return
	}

	// Set result params for structured logging
	if len(result.Features) > 0 {
		c.Set(ctxKeyMatchLevel, string(result.Features[0].Properties.MatchLevel))
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

	req.Limit = fixLimit(req.Limit)
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
		slog.Error("reverse geocode request failed", "event", "reverse", "lon", req.Lon, "lat", req.Lat, "pref", pref, "category", category, "limit", req.Limit, "error", err)
		sendInternalServerError(c)
		return
	}

	// Set result params for structured logging
	if len(result.Features) > 0 {
		c.Set(ctxKeyMatchLevel, string(result.Features[0].Properties.MatchLevel))
		c.Set(ctxKeyDistance, result.Features[0].Properties.Distance)
	}

	s.setResultInfo(&result.ResultInfo)
	sendGeoJSON(c, result)
}

func (s *GinServer) MatchHandler(c *gin.Context) {
	var req matchRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		sendBadRequest(c, formatBindError(err))
		return
	}

	category, pref, limit, ok := s.handleAddressRequest(c, req.Address, req.Category, req.Pref, req.Limit)
	if !ok {
		return
	}

	// Set request params for structured logging
	c.Set(ctxKeyAddress, req.Address)
	c.Set(ctxKeyCategory, string(category))
	c.Set(ctxKeyPref, pref)

	result, err := s.matcher.Match(c.Request.Context(), model.MatchQuery{
		Address:  req.Address,
		Category: category,
		Limit:    limit,
		Pref:     pref,
	})
	if err != nil {
		slog.Error("match request failed", "event", "match", "address", req.Address, "pref", pref, "category", category, "limit", limit, "error", err)
		sendInternalServerError(c)
		return
	}

	// Set result params for structured logging
	if len(result.Features) > 0 {
		c.Set(ctxKeyMatchLevel, string(result.Features[0].MatchLevel))
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
	endpoints := []string{"/", "/health", "/normalize"}
	if s.matcher != nil {
		endpoints = append(endpoints, "/match")
	}
	if s.matcher != nil && s.enabledPos {
		endpoints = append(endpoints, "/geocode")
	}
	if s.reverseGeocoder != nil && s.enabledPos {
		endpoints = append(endpoints, "/reverse")
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
	c.JSON(http.StatusServiceUnavailable, gin.H{
		"status":  "error",
		"message": "This endpoint requires enable_pos=true in the database.",
	})
}

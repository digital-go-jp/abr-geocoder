package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"abrg/internal/cache"
	"abrg/internal/matching"
	"abrg/internal/model"
	"abrg/internal/repository"
	"abrg/internal/reverse"
)

const (
	ctxKeyAddress    = "log_address"
	ctxKeyLat        = "log_lat"
	ctxKeyLon        = "log_lon"
	ctxKeyCategory   = "log_category"
	ctxKeyPref       = "log_pref"
	ctxKeyMatchLevel = "log_match_level"
	ctxKeyCoordLevel = "log_coord_level"
	ctxKeyDistance   = "log_distance"
)

var _ io.Closer = (*GinServer)(nil)

type ServerConfig struct {
	APIVersion       string
	CORSAllowOrigins []string
	Cache            *cache.DuckDBCache // Pre-created cache for dependency injection
	CacheConfig      cache.Config       // Configuration loaded from the cache
}

type reverser interface {
	Reverse(ctx context.Context, query model.ReverseQuery) (*model.ReverseResponse, error)
}

type GinServer struct {
	matcher         matching.Matcher
	repo            matching.CoordinatesGetter
	reverseGeocoder reverser
	router          *gin.Engine
	apiVersion      string
	dbVersion       string
	enabledCategory string
	enabledPref     string
	enabledPos      bool
	cache           *cache.DuckDBCache
}

// allowEveryOrigin is what an unset CORS configuration means. It matches the
// default the config package reports, restated here so this package does not
// depend on it.
const allowEveryOrigin = "*"

// configureCORS allows the given origins, treating an empty list as every
// origin.
//
// The library's own defaults are deliberately not used for that case. Their
// allowed headers omit X-API-Key, and a frontend built against the deployed
// API sends that header whether or not the instance it is pointed at checks
// it, so the preflight of a browser calling the service directly would fail.
func configureCORS(r *gin.Engine, allowOrigins []string) {
	if len(allowOrigins) == 0 {
		allowOrigins = []string{allowEveryOrigin}
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins: allowOrigins,
		AllowMethods: []string{"GET", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "X-API-Key"},
	}))
}

func accessLogFormatter(param gin.LogFormatterParams) string {
	var buf strings.Builder

	fmt.Fprintf(&buf, "[GIN] %v | %3d | %13v | %15s | %-7s %#v",
		param.TimeStamp.Format("2006/01/02 - 15:04:05"),
		param.StatusCode,
		param.Latency.Truncate(time.Microsecond),
		param.ClientIP,
		param.Method,
		param.Path)

	if addr, ok := param.Keys[ctxKeyAddress].(string); ok {
		fmt.Fprintf(&buf, " address=%q", addr)
	}
	if lat, ok := param.Keys[ctxKeyLat].(float64); ok {
		fmt.Fprintf(&buf, " lat=%.6f", lat)
	}
	if lon, ok := param.Keys[ctxKeyLon].(float64); ok {
		fmt.Fprintf(&buf, " lon=%.6f", lon)
	}
	if cat, ok := param.Keys[ctxKeyCategory].(string); ok {
		fmt.Fprintf(&buf, " category=%s", cat)
	}
	if pref, ok := param.Keys[ctxKeyPref].(string); ok {
		fmt.Fprintf(&buf, " pref=%s", pref)
	}
	if level, ok := param.Keys[ctxKeyMatchLevel].(string); ok {
		fmt.Fprintf(&buf, " match_level=%s", level)
	}
	if coord, ok := param.Keys[ctxKeyCoordLevel].(string); ok {
		fmt.Fprintf(&buf, " coord_level=%s", coord)
	}
	if dist, ok := param.Keys[ctxKeyDistance].(float64); ok {
		fmt.Fprintf(&buf, " distance=%.2f", dist)
	}

	buf.WriteString("\n")
	return buf.String()
}

// endpointSpec declares one GET route. The same table drives route
// registration and the endpoint listing served by RootHandler, so the two
// can never drift apart.
type endpointSpec struct {
	path    string
	handler func(*GinServer, *gin.Context)
	// hasComponent reports whether the backing component is wired; nil means
	// the endpoint needs no component. Routes without their component are not
	// registered.
	hasComponent func(*GinServer) bool
	// needsPos marks endpoints that require position data. Without it the
	// route answers with PositionDataDisabledHandler and is not listed.
	needsPos bool
}

// endpointSpecs is ordered as the endpoints appear in the RootHandler output.
// It is a function rather than a package variable because RootHandler is both
// listed in and derived from the table.
func endpointSpecs() []endpointSpec {
	return []endpointSpec{
		{path: "/", handler: (*GinServer).RootHandler},
		{path: "/health", handler: (*GinServer).HealthHandler},
		{path: "/normalize", handler: (*GinServer).NormalizeHandler},
		{path: "/match", handler: (*GinServer).MatchHandler,
			hasComponent: func(s *GinServer) bool { return s.matcher != nil }},
		{path: "/geocode", handler: (*GinServer).GeocodeHandler, needsPos: true,
			hasComponent: func(s *GinServer) bool { return s.matcher != nil }},
		{path: "/reverse", handler: (*GinServer).ReverseHandler, needsPos: true,
			hasComponent: func(s *GinServer) bool { return s.reverseGeocoder != nil }},
	}
}

// available reports whether the endpoint serves its real handler on s.
func (e endpointSpec) available(s *GinServer) bool {
	if e.hasComponent != nil && !e.hasComponent(s) {
		return false
	}
	return !e.needsPos || s.enabledPos
}

// registerEndpoints wires every endpointSpec onto the router.
func registerEndpoints(router *gin.Engine, server *GinServer) {
	for _, spec := range endpointSpecs() {
		if spec.hasComponent != nil && !spec.hasComponent(server) {
			continue
		}
		handler := spec.handler
		if spec.needsPos && !server.enabledPos {
			handler = (*GinServer).PositionDataDisabledHandler
		}
		router.GET(spec.path, func(c *gin.Context) { handler(server, c) })
	}
}

func NewGinServer(cfg ServerConfig) *GinServer {
	registerFormTagNames()
	router := gin.New()
	router.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		Formatter: accessLogFormatter,
		SkipPaths: []string{"/health"},
	}))
	// Keep every error response, including panics and unmatched routes, on the
	// JSON error contract {"status":"error","message":"..."}.
	router.Use(gin.CustomRecovery(func(c *gin.Context, _ any) {
		c.AbortWithStatusJSON(http.StatusInternalServerError, errorResponse("Internal Server Error"))
	}))
	router.HandleMethodNotAllowed = true
	router.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, errorResponse("not found"))
	})
	router.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, errorResponse("method not allowed"))
	})

	configureCORS(router, cfg.CORSAllowOrigins)

	server := &GinServer{
		router:          router,
		apiVersion:      cfg.APIVersion,
		dbVersion:       cfg.CacheConfig.DBVersion,
		enabledCategory: cfg.CacheConfig.EnabledCategory,
		enabledPref:     cfg.CacheConfig.EnabledPref,
		enabledPos:      cfg.CacheConfig.PosEnabled(),
		cache:           cfg.Cache,
	}

	// Assign the components only when they exist so the interface fields stay
	// untyped nil (a typed-nil *repository.DB would make nil checks pass).
	if cfg.Cache != nil {
		repo := repository.NewRepository(cfg.Cache.DB())
		server.repo = repo
		// Data availability follows the build configuration; the presence of
		// the category tables themselves is verified at cache open.
		hasResidential, hasParcel := cfg.CacheConfig.HasResidential(), cfg.CacheConfig.HasParcel()
		server.matcher = matching.NewMatcher(repo, cfg.Cache.Lookups(), hasResidential, hasParcel)
		server.reverseGeocoder = reverse.NewReverseGeocoder(repo, hasResidential, hasParcel)
	}

	registerEndpoints(router, server)

	return server
}

func (s *GinServer) Handler() http.Handler {
	return s.router
}

func (s *GinServer) Close() error {
	if s.cache != nil {
		return s.cache.Close()
	}
	return nil
}

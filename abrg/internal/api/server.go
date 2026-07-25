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
	"abrg/internal/infra/duckdb"
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
	APIVersion      string
	DBVersion       string
	EnabledPos      bool
	EnabledCategory string
	EnabledPref     string
	CORSAllowOrigin string
	Cache           *cache.DuckDBCache // Pre-created cache for dependency injection
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

func configureCORS(r *gin.Engine, allowOrigin string) {
	if allowOrigin == "" {
		r.Use(cors.Default())
	} else {
		r.Use(cors.New(cors.Config{
			AllowOrigins: []string{allowOrigin},
			AllowMethods: []string{"GET", "OPTIONS"},
			AllowHeaders: []string{"Origin", "Content-Type", "X-API-Key"},
		}))
	}
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

func registerPositionEndpoint(r *gin.Engine, path string, component any, enablePositionData bool, handler, disabledHandler gin.HandlerFunc) {
	if component == nil {
		return
	}
	if enablePositionData {
		r.GET(path, handler)
	} else {
		r.GET(path, disabledHandler)
	}
}

func NewGinServer(cfg ServerConfig) *GinServer {
	router := gin.New()
	router.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		Formatter: accessLogFormatter,
		SkipPaths: []string{"/health"},
	}))
	router.Use(gin.Recovery())

	configureCORS(router, cfg.CORSAllowOrigin)

	var matcher *matching.Impl
	var repo *repository.DB
	var reverseGeocoder *reverse.ReverseGeocoder

	if cfg.Cache != nil {
		repo = repository.NewRepository(cfg.Cache.DB())
		matcher = matching.NewMatcher(repo, cfg.Cache.Lookups())
		reverseGeocoder = reverse.NewReverseGeocoder(repo,
			reverse.TableExists(context.Background(), cfg.Cache.DB(), duckdb.TableRsdtdsp),
			reverse.TableExists(context.Background(), cfg.Cache.DB(), duckdb.TableParcel),
		)
	}

	server := &GinServer{
		repo:            repo,
		router:          router,
		apiVersion:      cfg.APIVersion,
		dbVersion:       cfg.DBVersion,
		enabledCategory: cfg.EnabledCategory,
		enabledPref:     cfg.EnabledPref,
		enabledPos:      cfg.EnabledPos,
		cache:           cfg.Cache,
	}

	if matcher != nil {
		server.matcher = matcher
	}
	if reverseGeocoder != nil {
		server.reverseGeocoder = reverseGeocoder
	}

	registerPositionEndpoint(router, "/geocode", server.matcher, cfg.EnabledPos,
		server.GeocodeHandler, server.PositionDataDisabledHandler)
	registerPositionEndpoint(router, "/reverse", server.reverseGeocoder, cfg.EnabledPos,
		server.ReverseHandler, server.PositionDataDisabledHandler)

	if matcher != nil {
		router.GET("/match", server.MatchHandler)
	}

	router.GET("/normalize", server.NormalizeHandler)
	router.GET("/health", server.HealthHandler)
	router.GET("/", server.RootHandler)

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

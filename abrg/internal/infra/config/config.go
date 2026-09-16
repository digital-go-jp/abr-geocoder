package config

import (
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/digital-go-jp/abr-geocoder/common/env"

	"github.com/digital-go-jp/abr-geocoder/abrg/internal/infra/duckdb"
)

// DefaultCORSAllowOrigin allows every origin, which suits a public read-only
// API that uses no credentials.
const DefaultCORSAllowOrigin = "*"

// HTTP server timeouts. They sit below the 29 second limit API Gateway applies
// to an integration, so a request that stalls fails at the server first.
const (
	readTimeout  = 10 * time.Second
	writeTimeout = 30 * time.Second
	idleTimeout  = 60 * time.Second
)

// splitOrigins turns the configured value into the origins the CORS middleware
// matches against. Commas separate them, so more than one frontend can be
// allowed; surrounding spaces and empty entries are ignored. A value that
// leaves nothing behind falls back to the default rather than disabling every
// origin, which the middleware rejects outright.
func splitOrigins(value string) []string {
	var origins []string
	for origin := range strings.SplitSeq(value, ",") {
		if origin = strings.TrimSpace(origin); origin != "" {
			origins = append(origins, origin)
		}
	}
	if len(origins) == 0 {
		return []string{DefaultCORSAllowOrigin}
	}
	return origins
}

func defaultCachePath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".abrg", "cache", "abrg.duckdb")
}

type Config struct {
	Server ServerConfig
	Cache  cacheConfig
}

type ServerConfig struct {
	// Host is the address to listen on.
	// An empty Host listens on every interface.
	Host             string
	Port             string
	CORSAllowOrigins []string
	// HTTP server timeouts. ReadTimeout also serves as the header read timeout.
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// Addr returns the host:port address the server listens on.
func (c ServerConfig) Addr() string {
	return net.JoinHostPort(c.Host, c.Port)
}

type cacheConfig struct {
	Path string
	// DuckDBThreads caps DuckDB's intra-query parallelism ("0" keeps the
	// DuckDB default of one thread per core).
	DuckDBThreads string
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Host:             env.GetEnv("ABRG_HTTP_HOST", ""),
			Port:             env.GetEnv("ABRG_HTTP_PORT", "3000"),
			CORSAllowOrigins: splitOrigins(env.GetEnv("ABRG_CORS_ALLOW_ORIGIN", DefaultCORSAllowOrigin)),
			ReadTimeout:      readTimeout,
			WriteTimeout:     writeTimeout,
			IdleTimeout:      idleTimeout,
		},
		Cache: cacheConfig{
			Path:          env.GetEnv(duckdb.EnvCachePath, defaultCachePath()),
			DuckDBThreads: env.GetEnv("ABRG_DUCKDB_THREADS", "2"),
		},
	}
}

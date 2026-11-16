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

// HTTP server timeouts. Read covers the headers and the body of a request,
// which are small, so it is the shortest; write leaves room for a large
// response, and idle keeps a connection open between requests.
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
	Cache  CacheConfig
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

type CacheConfig struct {
	Path string
	// DuckDBThreads caps DuckDB's intra-query parallelism ("0" keeps the
	// DuckDB default of one thread per core).
	DuckDBThreads string
	// DuckDBMemoryLimit caps the memory DuckDB keeps for cached blocks, as a
	// size such as "1GB" ("" keeps the DuckDB default of 80% of the machine's
	// memory).
	DuckDBMemoryLimit string
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
		Cache: CacheConfig{
			Path:              env.GetEnv(duckdb.EnvCachePath, defaultCachePath()),
			DuckDBThreads:     env.GetEnv("ABRG_DUCKDB_THREADS", "2"),
			DuckDBMemoryLimit: env.GetEnv("ABRG_DUCKDB_MEMORY_LIMIT", ""),
		},
	}
}

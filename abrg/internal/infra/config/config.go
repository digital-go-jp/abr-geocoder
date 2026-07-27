package config

import (
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"abr.local/common/env"

	"abrg/internal/infra/duckdb"
)

// DefaultCORSAllowOrigin allows every origin, which suits a public read-only
// API that uses no credentials.
const DefaultCORSAllowOrigin = "*"

// splitOrigins turns the configured value into the origins the CORS middleware
// matches against. Commas separate them, so more than one frontend can be
// allowed; surrounding spaces and empty entries are ignored. A value that
// leaves nothing behind falls back to the default rather than disabling every
// origin, which the middleware rejects outright.
func splitOrigins(value string) []string {
	var origins []string
	for _, origin := range strings.Split(value, ",") {
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
	Port             string
	CORSAllowOrigins []string
	// HTTP server timeouts, tunable to match the idle settings of a fronting
	// ALB or API Gateway. ReadTimeout also serves as the header read timeout.
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
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
			Port:             env.GetEnv("PORT", "3000"),
			CORSAllowOrigins: splitOrigins(env.GetEnv("CORS_ALLOW_ORIGIN", DefaultCORSAllowOrigin)),
			ReadTimeout:      durationEnv("ABRG_HTTP_READ_TIMEOUT", 10*time.Second),
			WriteTimeout:     durationEnv("ABRG_HTTP_WRITE_TIMEOUT", 30*time.Second),
			IdleTimeout:      durationEnv("ABRG_HTTP_IDLE_TIMEOUT", 60*time.Second),
		},
		Cache: cacheConfig{
			Path:          env.GetEnv(duckdb.EnvCachePath, defaultCachePath()),
			DuckDBThreads: env.GetEnv("ABRG_DUCKDB_THREADS", "2"),
		},
	}
}

// durationEnv reads a Go duration string ("10s", "1m30s") from the named
// environment variable. Unset, invalid, or non-positive values fall back to
// the default.
func durationEnv(name string, def time.Duration) time.Duration {
	v, ok := os.LookupEnv(name)
	if !ok || v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		slog.Warn("ignoring invalid duration setting", "event", "config", "env", name, "value", v)
		return def
	}
	return d
}

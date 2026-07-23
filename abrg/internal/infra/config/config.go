package config

import (
	"os"
	"path/filepath"

	"abr.local/common/env"
)

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
	Port            string
	CORSAllowOrigin string
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
			Port:            env.GetEnv("PORT", "3000"),
			CORSAllowOrigin: env.GetEnv("CORS_ALLOW_ORIGIN", ""),
		},
		Cache: cacheConfig{
			Path:          env.GetEnv("CACHE_PATH", defaultCachePath()),
			DuckDBThreads: env.GetEnv("ABRG_DUCKDB_THREADS", "2"),
		},
	}
}

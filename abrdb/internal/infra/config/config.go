package config

import (
	"abr.local/common/db"
	"abr.local/common/env"
)

const (
	DefaultFeedURL = "https://dataset.address-br.digital.go.jp/api/feed/dcat-us/1.1.json"
	// Also the volume mount point that abrdb/Dockerfile creates.
	DefaultDownloadDir = "/tmp/abrdb/data"
)

type Config struct {
	Database db.DBConfig
	API      APIConfig
	Process  ProcessConfig
}

type APIConfig struct {
	FeedURL string
}

type ProcessConfig struct {
	DownloadDir string
}

func Load() *Config {
	return &Config{
		Database: db.LoadDBConfigFromEnv(),
		API: APIConfig{
			FeedURL: env.GetEnv("ABRDB_FEED_URL", DefaultFeedURL),
		},
		Process: ProcessConfig{
			DownloadDir: env.GetEnv("ABRDB_DOWNLOAD_DIR", DefaultDownloadDir),
		},
	}
}

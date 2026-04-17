// Package db provides PostgreSQL database connection and query execution utilities.
package db

import (
	"fmt"
	"net/url"

	"abr.local/common/env"
)

// DBConfig represents database configuration
type DBConfig struct {
	Host     string
	Port     string
	Database string
	User     string
	Password string
	SSLMode  string
}

func (c DBConfig) DSN() string {
	var userInfo string
	if c.Password == "" {
		userInfo = url.User(c.User).String()
	} else {
		userInfo = url.UserPassword(c.User, c.Password).String()
	}
	return fmt.Sprintf("postgres://%s@%s:%s/%s?sslmode=%s",
		userInfo, c.Host, c.Port, c.Database, c.SSLMode)
}

// LoadDBConfigFromEnv loads database configuration from environment variables.
func LoadDBConfigFromEnv() DBConfig {
	return DBConfig{
		Host:     env.GetEnv("DB_HOST", "localhost"),
		Port:     env.GetEnv("DB_PORT", "5432"),
		Database: env.GetEnv("DB_NAME", "abrdb"),
		User:     env.GetEnv("DB_USER", "postgres"),
		Password: env.GetEnv("DB_PASSWORD", ""),
		SSLMode:  env.GetEnv("DB_SSLMODE", "prefer"),
	}
}

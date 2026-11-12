// Package config loads and validates application configuration from environment
// variables. Using env vars (not config files) makes the app 12-factor
// compliant and simplifies Docker/Kubernetes deployments.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the application.
type Config struct {
	Port    string
	Env     string
	DB      DBConfig
	CORS    CORSConfig
	WS      WSConfig
}

// DBConfig holds PostgreSQL connection settings.
type DBConfig struct {
	URL             string
	MaxConns        int32
	MinConns        int32
	MaxConnIdleSecs int
}

// CORSConfig holds allowed origins for cross-origin requests.
type CORSConfig struct {
	AllowedOrigins []string
}

// WSConfig holds WebSocket tuning parameters.
type WSConfig struct {
	ReadBufferSize  int
	WriteBufferSize int
	ClientBuffer    int
}

// Load reads .env (if present) then environment variables and returns a
// validated Config. It returns an error if any required variable is missing.
func Load() (*Config, error) {
	// Best-effort .env load — in production the variables arrive via the
	// container runtime so the file won't exist and that is fine.
	_ = godotenv.Load()

	cfg := &Config{}

	cfg.Port = getEnv("PORT", "8080")
	cfg.Env = getEnv("ENV", "development")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	cfg.DB = DBConfig{
		URL:             dbURL,
		MaxConns:        int32(getEnvInt("DB_MAX_CONNS", 20)),
		MinConns:        int32(getEnvInt("DB_MIN_CONNS", 2)),
		MaxConnIdleSecs: getEnvInt("DB_MAX_CONN_IDLE_SECS", 300),
	}

	originsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
	cfg.CORS = CORSConfig{
		AllowedOrigins: strings.Fields(originsRaw),
	}

	cfg.WS = WSConfig{
		ReadBufferSize:  getEnvInt("WS_READ_BUFFER_SIZE", 1024),
		WriteBufferSize: getEnvInt("WS_WRITE_BUFFER_SIZE", 1024),
		ClientBuffer:    getEnvInt("WS_CLIENT_BUFFER_SIZE", 256),
	}

	return cfg, nil
}

// IsDevelopment returns true when the application is running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return v
}

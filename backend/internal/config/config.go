package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port        string
	DatabaseURL string
	CORSOrigin  string

	// AIProvider selects the analyzer implementation: "claude" or "stub".
	// Empty falls back to "claude" when AIAPIKey is set, otherwise "stub".
	AIProvider string
	AIAPIKey   string
	AIModel    string

	// AuthMode selects how requests are authenticated: "dev" (fixed user) for now,
	// "firebase" once Firebase Auth is wired in.
	AuthMode  string
	DevUserID uint
}

func Load() Config {
	cfg := Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/nutrition?sslmode=disable"),
		CORSOrigin:  getEnv("CORS_ORIGIN", "http://localhost:3000"),
		AIProvider:  os.Getenv("AI_PROVIDER"),
		AIAPIKey:    os.Getenv("AI_API_KEY"),
		AIModel:     getEnv("AI_MODEL", "claude-opus-5"),
		AuthMode:    getEnv("AUTH_MODE", "dev"),
		DevUserID:   getEnvUint("DEV_USER_ID", 1),
	}
	if cfg.AIProvider == "" {
		if cfg.AIAPIKey != "" {
			cfg.AIProvider = "claude"
		} else {
			cfg.AIProvider = "stub"
		}
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvUint(key string, fallback uint) uint {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseUint(v, 10, 32)
	if err != nil {
		return fallback
	}
	return uint(n)
}

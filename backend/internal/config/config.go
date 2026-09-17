package config

import (
	"log/slog"
	"os"
	"strconv"
	"strings"
)

const (
	AIProviderClaude = "claude"
	AIProviderGemini = "gemini"
	AIProviderStub   = "stub"
)

var defaultAIModels = map[string]string{
	AIProviderClaude: "claude-opus-5",
	AIProviderGemini: "gemini-3.6-flash",
}

type Config struct {
	Port        string
	DatabaseURL string
	CORSOrigin  string

	// AIProvider selects the AI implementation: "claude", "gemini" or "stub".
	// Empty is inferred from the AIAPIKey prefix, or "stub" when there is no key.
	AIProvider string
	AIAPIKey   string
	// AIModel defaults per provider when empty.
	AIModel string

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
		AIProvider:  strings.ToLower(strings.TrimSpace(os.Getenv("AI_PROVIDER"))),
		AIAPIKey:    strings.TrimSpace(os.Getenv("AI_API_KEY")),
		AIModel:     strings.TrimSpace(os.Getenv("AI_MODEL")),
		AuthMode:    getEnv("AUTH_MODE", "dev"),
		DevUserID:   getEnvUint("DEV_USER_ID", 1),
	}
	if cfg.AIProvider == "" {
		cfg.AIProvider = inferAIProvider(cfg.AIAPIKey)
	}
	if cfg.AIModel == "" {
		cfg.AIModel = defaultAIModels[cfg.AIProvider]
	}
	return cfg
}

func inferAIProvider(key string) string {
	switch {
	case key == "":
		return AIProviderStub
	case strings.HasPrefix(key, "sk-ant-"):
		return AIProviderClaude
	case strings.HasPrefix(key, "AIza"):
		return AIProviderGemini
	default:
		slog.Warn("AI_API_KEY is set but its provider can't be inferred; set AI_PROVIDER. Using stub AI")
		return AIProviderStub
	}
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

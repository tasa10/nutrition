package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"
	"gorm.io/gorm"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/config"
	"nutrition/backend/internal/db"
	"nutrition/backend/internal/handler"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg := config.Load()

	gormDB, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer func() {
		if sqlDB, err := gormDB.DB(); err == nil {
			if err := sqlDB.Close(); err != nil {
				slog.Warn("failed to close database", "error", err)
			}
		}
	}()

	if err := db.Migrate(gormDB); err != nil {
		return fmt.Errorf("migrate database: %w", err)
	}

	aiService := newAIService(context.Background(), cfg)
	authenticator, err := newAuthenticator(cfg, gormDB)
	if err != nil {
		return err
	}

	e := echo.New()
	e.Use(middleware.Recover())
	e.Use(middleware.RequestLogger())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{cfg.CORSOrigin},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderContentType, echo.HeaderAuthorization},
	}))

	e.GET("/api/health", handler.NewHealthHandler(gormDB).Get)

	api := e.Group("/api", auth.Middleware(authenticator))
	api.GET("/me", handler.Me)

	foodHandler := handler.NewFoodHandler(gormDB, aiService)
	api.POST("/foods/search", foodHandler.Search)
	api.GET("/foods/frequent", foodHandler.Frequent)

	profileHandler := handler.NewProfileHandler(gormDB)
	api.GET("/profile", profileHandler.Get)
	api.PUT("/profile", profileHandler.Put)

	mealHandler := handler.NewMealHandler(gormDB, aiService)
	api.POST("/meals/analyze", mealHandler.Analyze)
	api.GET("/days/:date", mealHandler.GetDay)
	api.PUT("/meals/:date/:slot", mealHandler.Upsert)
	api.DELETE("/meals/:date/:slot", mealHandler.Delete)

	chatHandler := handler.NewChatHandler(gormDB, aiService)
	api.GET("/chat", chatHandler.Get)
	api.POST("/chat", chatHandler.Post)
	api.POST("/chat/notes", chatHandler.PostNote)
	api.DELETE("/chat", chatHandler.Clear)

	statsHandler := handler.NewStatsHandler(gormDB)
	api.GET("/stats", statsHandler.Get)
	api.GET("/history", statsHandler.History)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	sc := echo.StartConfig{Address: ":" + cfg.Port}
	if err := sc.Start(ctx, e); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server stopped: %w", err)
	}
	slog.Info("server shut down gracefully")
	return nil
}

func newAIService(ctx context.Context, cfg config.Config) ai.Service {
	switch cfg.AIProvider {
	case config.AIProviderClaude, config.AIProviderGemini:
		if cfg.AIAPIKey == "" {
			slog.Warn("AI_API_KEY is empty; falling back to stub AI", "provider", cfg.AIProvider)
			return ai.Stub{}
		}
		if cfg.AIProvider == config.AIProviderClaude {
			slog.Info("using Claude AI", "model", cfg.AIModel)
			return ai.NewClaude(cfg.AIAPIKey, cfg.AIModel)
		}
		g, err := ai.NewGemini(ctx, cfg.AIAPIKey, cfg.AIModel)
		if err != nil {
			slog.Warn("failed to initialize Gemini; falling back to stub AI", "error", err)
			return ai.Stub{}
		}
		slog.Info("using Gemini AI", "model", cfg.AIModel)
		return g
	case config.AIProviderStub:
		slog.Info("using stub AI (set AI_API_KEY to enable real analysis)")
		return ai.Stub{}
	default:
		slog.Warn("unknown AI_PROVIDER; falling back to stub AI", "provider", cfg.AIProvider)
		return ai.Stub{}
	}
}

func newAuthenticator(cfg config.Config, gormDB *gorm.DB) (auth.Authenticator, error) {
	switch cfg.AuthMode {
	case "dev":
		slog.Warn("AUTH_MODE=dev: every request is signed in as a fixed user", "user_id", cfg.DevUserID)
		return auth.Dev{DB: gormDB, UserID: cfg.DevUserID}, nil
	case "firebase":
		if cfg.FirebaseProjectID == "" {
			return nil, errors.New("AUTH_MODE=firebase requires FIREBASE_PROJECT_ID")
		}
		fb, err := auth.NewFirebase(context.Background(), gormDB, cfg.FirebaseProjectID)
		if err != nil {
			return nil, err
		}
		slog.Info("using Firebase Auth", "project", cfg.FirebaseProjectID)
		return fb, nil
	default:
		return nil, fmt.Errorf("unsupported AUTH_MODE %q (use \"dev\" or \"firebase\")", cfg.AuthMode)
	}
}

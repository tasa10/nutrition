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

	analyzer := newAnalyzer(cfg)
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

	foodHandler := handler.NewFoodHandler(gormDB)
	api.GET("/foods", foodHandler.List)
	api.POST("/foods", foodHandler.Create)

	profileHandler := handler.NewProfileHandler(gormDB)
	api.GET("/profile", profileHandler.Get)
	api.PUT("/profile", profileHandler.Put)

	mealHandler := handler.NewMealHandler(gormDB, analyzer)
	api.POST("/meals/analyze", mealHandler.Analyze)
	api.GET("/days/:date", mealHandler.GetDay)
	api.PUT("/meals/:date/:slot", mealHandler.Upsert)
	api.DELETE("/meals/:date/:slot", mealHandler.Delete)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	sc := echo.StartConfig{Address: ":" + cfg.Port}
	if err := sc.Start(ctx, e); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server stopped: %w", err)
	}
	slog.Info("server shut down gracefully")
	return nil
}

func newAnalyzer(cfg config.Config) ai.Analyzer {
	switch cfg.AIProvider {
	case "claude":
		if cfg.AIAPIKey == "" {
			slog.Warn("AI_PROVIDER=claude but AI_API_KEY is empty; falling back to stub analyzer")
			return ai.Stub{}
		}
		slog.Info("using Claude analyzer", "model", cfg.AIModel)
		return ai.NewClaude(cfg.AIAPIKey, cfg.AIModel)
	case "stub":
		slog.Info("using stub analyzer (set AI_API_KEY to enable real analysis)")
		return ai.Stub{}
	default:
		slog.Warn("unknown AI_PROVIDER; falling back to stub analyzer", "provider", cfg.AIProvider)
		return ai.Stub{}
	}
}

func newAuthenticator(cfg config.Config, gormDB *gorm.DB) (auth.Authenticator, error) {
	switch cfg.AuthMode {
	case "dev":
		slog.Warn("AUTH_MODE=dev: every request is signed in as a fixed user", "user_id", cfg.DevUserID)
		return auth.Dev{DB: gormDB, UserID: cfg.DevUserID}, nil
	default:
		return nil, fmt.Errorf("unsupported AUTH_MODE %q (only \"dev\" is implemented)", cfg.AuthMode)
	}
}

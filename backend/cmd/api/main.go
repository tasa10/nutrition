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

	"nutrition/backend/internal/ai"
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

	e := echo.New()
	e.Use(middleware.Recover())
	e.Use(middleware.RequestLogger())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{cfg.CORSOrigin},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
	}))

	healthHandler := handler.NewHealthHandler(gormDB)
	e.GET("/api/health", healthHandler.Get)

	foodHandler := handler.NewFoodHandler(gormDB)
	e.GET("/api/foods", foodHandler.List)
	e.POST("/api/foods", foodHandler.Create)

	profileHandler := handler.NewProfileHandler(gormDB)
	e.GET("/api/profile", profileHandler.Get)
	e.PUT("/api/profile", profileHandler.Put)

	mealHandler := handler.NewMealHandler(gormDB, analyzer)
	e.POST("/api/meals/analyze", mealHandler.Analyze)
	e.GET("/api/days/:date", mealHandler.GetDay)
	e.PUT("/api/meals/:date/:slot", mealHandler.Upsert)
	e.DELETE("/api/meals/:date/:slot", mealHandler.Delete)

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

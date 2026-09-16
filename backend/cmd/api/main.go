package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/labstack/echo/v5"
	"github.com/labstack/echo/v5/middleware"

	"nutrition/backend/internal/config"
	"nutrition/backend/internal/db"
	"nutrition/backend/internal/handler"
)

func main() {
	cfg := config.Load()

	gormDB, err := db.Connect(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer func() {
		if sqlDB, err := gormDB.DB(); err == nil {
			sqlDB.Close()
		}
	}()

	if err := db.Migrate(gormDB); err != nil {
		slog.Error("failed to migrate database", "error", err)
		os.Exit(1)
	}

	e := echo.New()
	e.Use(middleware.Recover())
	e.Use(middleware.RequestLogger())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{cfg.CORSOrigin},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodOptions},
	}))

	healthHandler := handler.NewHealthHandler(gormDB)
	e.GET("/api/health", healthHandler.Get)

	foodHandler := handler.NewFoodHandler(gormDB)
	e.GET("/api/foods", foodHandler.List)
	e.POST("/api/foods", foodHandler.Create)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	sc := echo.StartConfig{Address: ":" + cfg.Port}
	if err := sc.Start(ctx, e); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
	slog.Info("server shut down gracefully")
}

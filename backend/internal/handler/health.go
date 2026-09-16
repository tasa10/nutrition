package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"
)

const dbPingTimeout = 2 * time.Second

type HealthHandler struct {
	DB *gorm.DB
}

func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{DB: db}
}

func (h *HealthHandler) Get(c *echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), dbPingTimeout)
	defer cancel()

	dbStatus := "ok"
	code := http.StatusOK

	sqlDB, err := h.DB.DB()
	if err != nil || sqlDB.PingContext(ctx) != nil {
		dbStatus = "ng"
		code = http.StatusServiceUnavailable
	}

	return c.JSON(code, map[string]string{
		"status": "ok",
		"db":     dbStatus,
	})
}

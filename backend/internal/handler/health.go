package handler

import (
	"context"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
)

const dbPingTimeout = 2 * time.Second

// Pinger reports whether the database is reachable; *database.Pinger implements it.
type Pinger interface {
	Ping(ctx context.Context) error
}

type HealthHandler struct {
	db Pinger
}

func NewHealthHandler(db Pinger) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) Get(c *echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), dbPingTimeout)
	defer cancel()

	dbStatus := "ok"
	code := http.StatusOK

	if h.db.Ping(ctx) != nil {
		dbStatus = "ng"
		code = http.StatusServiceUnavailable
	}

	return c.JSON(code, map[string]string{
		"status": "ok",
		"db":     dbStatus,
	})
}

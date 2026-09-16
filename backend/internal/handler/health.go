package handler

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"
)

type HealthHandler struct {
	DB *gorm.DB
}

func NewHealthHandler(db *gorm.DB) *HealthHandler {
	return &HealthHandler{DB: db}
}

func (h *HealthHandler) Get(c *echo.Context) error {
	dbStatus := "ok"

	sqlDB, err := h.DB.DB()
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "ng"
	}

	return c.JSON(http.StatusOK, map[string]string{
		"status": "ok",
		"db":     dbStatus,
	})
}

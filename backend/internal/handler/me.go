package handler

import (
	"net/http"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/auth"
)

func Me(c *echo.Context) error {
	return c.JSON(http.StatusOK, auth.CurrentUser(c))
}

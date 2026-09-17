package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/ai"
)

// aiError maps an AI provider failure to a user-facing HTTP error.
func aiError(err error, op, message string) error {
	if errors.Is(err, ai.ErrRateLimited) {
		slog.Warn(op+" rate limited", "error", err)
		return echo.NewHTTPError(http.StatusTooManyRequests, "AIの利用上限に達しました。しばらく待ってから再度お試しください。")
	}
	if errors.Is(err, ai.ErrUnavailable) {
		slog.Warn(op+" provider unavailable", "error", err)
		return echo.NewHTTPError(http.StatusServiceUnavailable, "AIが混雑しています。少し時間をおいてもう一度お試しください。")
	}
	slog.Error(op+" failed", "error", err)
	return echo.NewHTTPError(http.StatusBadGateway, message)
}

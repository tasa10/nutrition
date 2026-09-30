package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/usecase"
)

// httpError maps a usecase failure to an HTTP error: validation → 400 with the usecase's message,
// AI failures → aiError, anything else → 500 with internal. Handlers check ErrNotFound themselves,
// since whether it's expected (and what to say) differs per endpoint.
func httpError(err error, internal string) error {
	var ve *usecase.ValidationError
	if errors.As(err, &ve) {
		return echo.NewHTTPError(http.StatusBadRequest, ve.Msg)
	}
	slog.Error(internal, "error", err)
	return echo.NewHTTPError(http.StatusInternalServerError, internal)
}

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

func parseDate(s string) (string, error) {
	date, ok := usecase.ParseDate(s)
	if !ok {
		return "", echo.NewHTTPError(http.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	return date, nil
}

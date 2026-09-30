package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
	"nutrition/backend/internal/usecase"
)

type ProfileHandler struct {
	uc usecase.ProfileUsecase
}

func NewProfileHandler(uc usecase.ProfileUsecase) *ProfileHandler {
	return &ProfileHandler{uc: uc}
}

type profileResponse struct {
	model.Profile
	TargetKcal int `json:"target_kcal"`
}

func (h *ProfileHandler) Get(c *echo.Context) error {
	p, err := h.uc.Get(c.Request().Context(), auth.UserID(c))
	if errors.Is(err, repository.ErrNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "profile not set")
	}
	if err != nil {
		return httpError(err, "failed to fetch profile")
	}
	return c.JSON(http.StatusOK, profileResponse{Profile: *p, TargetKcal: p.TargetKcal()})
}

type putProfileRequest struct {
	WeightNow     float64 `json:"weight_now"`
	WeightGoal    float64 `json:"weight_goal"`
	ActivityLevel int     `json:"activity_level"`
	// MonthlyBudget in yen: omitted keeps the current budget, 0 clears it.
	MonthlyBudget *int `json:"monthly_budget"`
}

func (h *ProfileHandler) Put(c *echo.Context) error {
	var req putProfileRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	p, err := h.uc.Save(c.Request().Context(), auth.UserID(c), usecase.SaveProfileInput{
		WeightNow: req.WeightNow, WeightGoal: req.WeightGoal,
		ActivityLevel: req.ActivityLevel, MonthlyBudget: req.MonthlyBudget,
	})
	if err != nil {
		return httpError(err, "failed to save profile")
	}
	return c.JSON(http.StatusOK, profileResponse{Profile: *p, TargetKcal: p.TargetKcal()})
}

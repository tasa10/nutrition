package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"nutrition/backend/internal/model"
)

type ProfileHandler struct {
	DB *gorm.DB
}

func NewProfileHandler(db *gorm.DB) *ProfileHandler {
	return &ProfileHandler{DB: db}
}

type profileResponse struct {
	model.Profile
	TargetKcal int `json:"target_kcal"`
}

func (h *ProfileHandler) Get(c *echo.Context) error {
	var p model.Profile
	err := h.DB.WithContext(c.Request().Context()).First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "profile not set")
	}
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch profile")
	}
	return c.JSON(http.StatusOK, profileResponse{Profile: p, TargetKcal: p.TargetKcal()})
}

type putProfileRequest struct {
	WeightNow     float64 `json:"weight_now"`
	WeightGoal    float64 `json:"weight_goal"`
	ActivityLevel int     `json:"activity_level"`
}

func (h *ProfileHandler) Put(c *echo.Context) error {
	var req putProfileRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if req.WeightNow <= 0 || req.WeightNow > 500 || req.WeightGoal <= 0 || req.WeightGoal > 500 {
		return echo.NewHTTPError(http.StatusBadRequest, "weight must be between 0 and 500")
	}
	if req.ActivityLevel < model.ActivityNormal || req.ActivityLevel > model.ActivityHigh {
		return echo.NewHTTPError(http.StatusBadRequest, "activity_level must be 0, 1 or 2")
	}

	ctx := c.Request().Context()
	var p model.Profile
	err := h.DB.WithContext(ctx).First(&p).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch profile")
	}
	p.WeightNow = req.WeightNow
	p.WeightGoal = req.WeightGoal
	p.ActivityLevel = req.ActivityLevel
	if err := h.DB.WithContext(ctx).Save(&p).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save profile")
	}
	return c.JSON(http.StatusOK, profileResponse{Profile: p, TargetKcal: p.TargetKcal()})
}

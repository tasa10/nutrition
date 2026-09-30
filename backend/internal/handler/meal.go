package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
	"nutrition/backend/internal/usecase"
)

type MealHandler struct {
	uc usecase.MealUsecase
}

func NewMealHandler(uc usecase.MealUsecase) *MealHandler {
	return &MealHandler{uc: uc}
}

type analyzeRequest struct {
	Text string `json:"text"`
}

func (h *MealHandler) Analyze(c *echo.Context) error {
	var req analyzeRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	result, err := h.uc.Analyze(c.Request().Context(), req.Text)
	if errors.Is(err, usecase.ErrAI) {
		return aiError(err, "meal analysis", "AI解析に失敗しました。もう一度お試しください。")
	}
	if err != nil {
		return httpError(err, "failed to analyze meal")
	}
	return c.JSON(http.StatusOK, result)
}

type totalsResponse struct {
	Kcal    float64 `json:"kcal"`
	Protein float64 `json:"protein"`
	Fat     float64 `json:"fat"`
	Carbs   float64 `json:"carbs"`
	Salt    float64 `json:"salt"`
	Sugar   float64 `json:"sugar"`
}

type dayResponse struct {
	Date       string         `json:"date"`
	TargetKcal int            `json:"target_kcal"`
	Totals     totalsResponse `json:"totals"`
	Meals      []model.Meal   `json:"meals"`
}

func (h *MealHandler) GetDay(c *echo.Context) error {
	date, err := parseDate(c.Param("date"))
	if err != nil {
		return err
	}
	day, err := h.uc.Day(c.Request().Context(), auth.UserID(c), date)
	if err != nil {
		return httpError(err, "failed to fetch meals")
	}
	return c.JSON(http.StatusOK, dayResponse{
		Date: day.Date, TargetKcal: day.TargetKcal, Meals: day.Meals,
		Totals: totalsResponse(day.Totals),
	})
}

type upsertMealRequest struct {
	Source string    `json:"source"`
	Items  []ai.Item `json:"items"`
	// Photo: omitted keeps the current photo, "" removes it, a data URL replaces it.
	Photo *string `json:"photo"`
	// Cost in yen: omitted keeps the current amount, a value replaces it.
	Cost *int `json:"cost"`
}

func (h *MealHandler) Upsert(c *echo.Context) error {
	date, err := parseDate(c.Param("date"))
	if err != nil {
		return err
	}
	var req upsertMealRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	saved, err := h.uc.Upsert(c.Request().Context(), auth.UserID(c), date, c.Param("slot"), usecase.UpsertMealInput{
		Source: req.Source, Items: req.Items, Photo: req.Photo, Cost: req.Cost,
	})
	if err != nil {
		return httpError(err, "failed to save meal")
	}
	return c.JSON(http.StatusOK, saved)
}

func (h *MealHandler) Delete(c *echo.Context) error {
	date, err := parseDate(c.Param("date"))
	if err != nil {
		return err
	}
	err = h.uc.Delete(c.Request().Context(), auth.UserID(c), date, c.Param("slot"))
	if errors.Is(err, repository.ErrNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "meal not found")
	}
	if err != nil {
		return httpError(err, "failed to delete meal")
	}
	return c.NoContent(http.StatusNoContent)
}

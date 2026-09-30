package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/usecase"
)

type FoodHandler struct {
	uc usecase.FoodUsecase
}

func NewFoodHandler(uc usecase.FoodUsecase) *FoodHandler {
	return &FoodHandler{uc: uc}
}

type itemsResponse struct {
	Items []ai.Item `json:"items"`
}

type searchFoodsRequest struct {
	Query string `json:"query"`
}

func (h *FoodHandler) Search(c *echo.Context) error {
	var req searchFoodsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	items, err := h.uc.Search(c.Request().Context(), req.Query)
	if errors.Is(err, usecase.ErrAI) {
		return aiError(err, "food search", "検索に失敗しました。もう一度お試しください。")
	}
	if err != nil {
		return httpError(err, "failed to search foods")
	}
	return c.JSON(http.StatusOK, itemsResponse{Items: items})
}

func (h *FoodHandler) Frequent(c *echo.Context) error {
	items, err := h.uc.Frequent(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return httpError(err, "failed to load frequent foods")
	}
	return c.JSON(http.StatusOK, itemsResponse{Items: items})
}

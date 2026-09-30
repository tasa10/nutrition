package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/domain/repository"
	"nutrition/backend/internal/usecase"
)

type BudgetHandler struct {
	uc usecase.BudgetUsecase
}

func NewBudgetHandler(uc usecase.BudgetUsecase) *BudgetHandler {
	return &BudgetHandler{uc: uc}
}

type slotCost struct {
	Slot string `json:"slot"`
	Cost int    `json:"cost"`
}

type budgetResponse struct {
	Month         string     `json:"month"`
	MonthlyBudget int        `json:"monthly_budget"`
	Spent         int        `json:"spent"`
	BySlot        []slotCost `json:"by_slot"`
}

// Get takes ?month=YYYY-MM.
func (h *BudgetHandler) Get(c *echo.Context) error {
	b, err := h.uc.Month(c.Request().Context(), auth.UserID(c), c.QueryParam("month"))
	if err != nil {
		return httpError(err, "failed to load budget")
	}
	bySlot := make([]slotCost, 0, len(b.BySlot))
	for _, s := range b.BySlot {
		bySlot = append(bySlot, slotCost(s))
	}
	return c.JSON(http.StatusOK, budgetResponse{
		Month: b.Month, MonthlyBudget: b.MonthlyBudget, Spent: b.Spent, BySlot: bySlot,
	})
}

type putBudgetRequest struct {
	MonthlyBudget int `json:"monthly_budget"`
}

func (h *BudgetHandler) Put(c *echo.Context) error {
	var req putBudgetRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	err := h.uc.SetMonthly(c.Request().Context(), auth.UserID(c), req.MonthlyBudget)
	if errors.Is(err, repository.ErrNotFound) {
		return echo.NewHTTPError(http.StatusNotFound, "profile not set")
	}
	if err != nil {
		return httpError(err, "failed to save budget")
	}
	return c.JSON(http.StatusOK, putBudgetRequest{MonthlyBudget: req.MonthlyBudget})
}

package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/model"
)

const monthLayout = "2006-01"

type BudgetHandler struct {
	DB *gorm.DB
}

func NewBudgetHandler(db *gorm.DB) *BudgetHandler {
	return &BudgetHandler{DB: db}
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

// Get sums what the user's meals cost in one calendar month (?month=YYYY-MM), in total and per slot.
func (h *BudgetHandler) Get(c *echo.Context) error {
	start, err := time.Parse(monthLayout, c.QueryParam("month"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "month must be YYYY-MM")
	}
	from := start.Format(dateLayout)
	to := start.AddDate(0, 1, -1).Format(dateLayout)

	ctx := c.Request().Context()
	userID := auth.UserID(c)

	var rows []struct {
		Slot string
		Cost int
	}
	if err := h.DB.WithContext(ctx).Model(&model.Meal{}).
		Select("slot, COALESCE(SUM(cost), 0) AS cost").
		Where("user_id = ? AND date BETWEEN ? AND ?", userID, from, to).
		Group("slot").Scan(&rows).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load budget")
	}
	bySlotCost := make(map[string]int, len(rows))
	spent := 0
	for _, r := range rows {
		bySlotCost[r.Slot] = r.Cost
		spent += r.Cost
	}
	// Always all four slots, in display order, so the client can render fixed rows.
	bySlot := make([]slotCost, 0, len(model.Slots))
	for _, s := range model.Slots {
		bySlot = append(bySlot, slotCost{Slot: s, Cost: bySlotCost[s]})
	}

	var p model.Profile
	if err := h.DB.WithContext(ctx).Where("user_id = ?", userID).First(&p).Error; err != nil &&
		!errors.Is(err, gorm.ErrRecordNotFound) {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load budget")
	}

	return c.JSON(http.StatusOK, budgetResponse{
		Month: start.Format(monthLayout), MonthlyBudget: p.MonthlyBudget, Spent: spent, BySlot: bySlot,
	})
}

type putBudgetRequest struct {
	MonthlyBudget int `json:"monthly_budget"`
}

// Put changes only the monthly budget; the rest of the profile is set during onboarding.
func (h *BudgetHandler) Put(c *echo.Context) error {
	var req putBudgetRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if !validBudget(req.MonthlyBudget) {
		return echo.NewHTTPError(http.StatusBadRequest, "monthly_budget must be between 0 and 10000000")
	}
	res := h.DB.WithContext(c.Request().Context()).Model(&model.Profile{}).
		Where("user_id = ?", auth.UserID(c)).Update("monthly_budget", req.MonthlyBudget)
	if res.Error != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save budget")
	}
	if res.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "profile not set")
	}
	return c.JSON(http.StatusOK, putBudgetRequest{MonthlyBudget: req.MonthlyBudget})
}

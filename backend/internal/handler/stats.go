package handler

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/usecase"
)

const defaultHistoryDays = 7

type StatsHandler struct {
	uc usecase.StatsUsecase
}

func NewStatsHandler(uc usecase.StatsUsecase) *StatsHandler {
	return &StatsHandler{uc: uc}
}

type badge struct {
	Key    string `json:"key"`
	Label  string `json:"label"`
	Earned bool   `json:"earned"`
}

type statsResponse struct {
	XP         int     `json:"xp"`
	Level      int     `json:"level"`
	XPInLevel  int     `json:"xp_in_level"`
	Streak     int     `json:"streak"`
	TodayMeals int     `json:"today_meals"`
	Badges     []badge `json:"badges"`
}

// Get takes ?date=YYYY-MM-DD, the client's local "today".
func (h *StatsHandler) Get(c *echo.Context) error {
	today, err := parseDate(c.QueryParam("date"))
	if err != nil {
		return err
	}
	s, err := h.uc.Stats(c.Request().Context(), auth.UserID(c), today)
	if err != nil {
		return httpError(err, "failed to load stats")
	}
	badges := make([]badge, 0, len(s.Badges))
	for _, b := range s.Badges {
		badges = append(badges, badge(b))
	}
	return c.JSON(http.StatusOK, statsResponse{
		XP: s.XP, Level: s.Level, XPInLevel: s.XPInLevel,
		Streak: s.Streak, TodayMeals: s.TodayMeals, Badges: badges,
	})
}

type historyDay struct {
	Date  string  `json:"date"`
	Kcal  float64 `json:"kcal"`
	Cost  int     `json:"cost"`
	Meals int     `json:"meals"`
}

type historyResponse struct {
	TargetKcal int          `json:"target_kcal"`
	Days       []historyDay `json:"days"`
}

// History takes ?to=YYYY-MM-DD and optionally ?days=N (default 7).
func (h *StatsHandler) History(c *echo.Context) error {
	to, ok := usecase.ParseDate(c.QueryParam("to"))
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "to must be YYYY-MM-DD")
	}
	n := defaultHistoryDays
	if v := c.QueryParam("days"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil {
			return echo.NewHTTPError(http.StatusBadRequest, "days must be between 1 and 31")
		}
		n = parsed
	}

	hist, err := h.uc.History(c.Request().Context(), auth.UserID(c), to, n)
	if err != nil {
		return httpError(err, "failed to load history")
	}
	days := make([]historyDay, 0, len(hist.Days))
	for _, d := range hist.Days {
		days = append(days, historyDay(d))
	}
	return c.JSON(http.StatusOK, historyResponse{TargetKcal: hist.TargetKcal, Days: days})
}

package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/model"
)

const (
	xpPerRecord       = 20
	xpPerManualRecord = 10
	xpPerLevel        = 100
	saltGoalGrams     = 7.5
	maxHistoryDays    = 31
)

type StatsHandler struct {
	DB *gorm.DB
}

func NewStatsHandler(db *gorm.DB) *StatsHandler {
	return &StatsHandler{DB: db}
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

// Get derives XP, level, streak and badges from the stored meals, so they never drift from the records.
// The date query param is the client's local "today".
func (h *StatsHandler) Get(c *echo.Context) error {
	today, ok := parseDate(c.QueryParam("date"))
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	ctx := c.Request().Context()
	userID := auth.UserID(c)

	summaries, err := loadDaySummaries(ctx, h.DB, userID, "0000-01-01", "9999-12-31")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load stats")
	}

	var sources []struct {
		Source string
		Count  int
	}
	if err := h.DB.WithContext(ctx).Model(&model.Meal{}).
		Select("source, COUNT(*) AS count").Where("user_id = ?", userID).Group("source").
		Scan(&sources).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load stats")
	}

	xp, voiceMeals := 0, 0
	for _, s := range sources {
		if s.Source == model.SourceManual {
			xp += xpPerManualRecord * s.Count
		} else {
			xp += xpPerRecord * s.Count
		}
		if s.Source == "voice" {
			voiceMeals = s.Count
		}
	}
	level := xp/xpPerLevel + 1

	byDate := make(map[string]daySummary, len(summaries))
	for _, s := range summaries {
		byDate[s.Date] = s
	}
	streak := computeStreak(byDate, today)
	target := loadTarget(ctx, h.DB, userID)

	resp := statsResponse{
		XP: xp, Level: level, XPInLevel: xp % xpPerLevel,
		Streak: streak, TodayMeals: byDate[today].Meals,
		Badges: []badge{
			{Key: "streak3", Label: "3日連続記録", Earned: streak >= 3},
			{Key: "voice10", Label: "音声で10食", Earned: voiceMeals >= 10},
			{Key: "pfc", Label: "PFC完璧な日", Earned: hasPFCPerfectDay(summaries, target)},
			{Key: "salt", Label: "塩分セーブ", Earned: hasSaltSaveDay(summaries)},
			{Key: "week", Label: "週間目標達成", Earned: hasGoalWeek(summaries, target)},
			{Key: "lv5", Label: "Lv.5到達", Earned: level >= 5},
		},
	}
	return c.JSON(http.StatusOK, resp)
}

// computeStreak counts consecutive recorded days ending today, or yesterday if today has no record yet.
func computeStreak(byDate map[string]daySummary, today string) int {
	t, err := time.Parse(dateLayout, today)
	if err != nil {
		return 0
	}
	if byDate[today].Meals == 0 {
		t = t.AddDate(0, 0, -1)
	}
	n := 0
	for byDate[t.Format(dateLayout)].Meals > 0 {
		n++
		t = t.AddDate(0, 0, -1)
	}
	return n
}

func within(v, goal float64) bool {
	return goal > 0 && v >= goal*0.8 && v <= goal*1.2
}

// hasPFCPerfectDay: protein, fat and carbs all within ±20% of the 25/25/50 energy split of the target.
func hasPFCPerfectDay(days []daySummary, target int) bool {
	t := float64(target)
	for _, d := range days {
		if within(d.Protein, t*0.25/4) && within(d.Fat, t*0.25/9) && within(d.Carbs, t*0.5/4) {
			return true
		}
	}
	return false
}

// hasSaltSaveDay: a reasonably complete day (2+ meals) under the salt goal.
func hasSaltSaveDay(days []daySummary) bool {
	for _, d := range days {
		if d.Meals >= 2 && d.Salt <= saltGoalGrams {
			return true
		}
	}
	return false
}

// hasGoalWeek: seven consecutive recorded days, each at or under the calorie target.
func hasGoalWeek(days []daySummary, target int) bool {
	if target <= 0 {
		return false
	}
	run := 0
	var prev time.Time
	for _, d := range days {
		t, err := time.Parse(dateLayout, d.Date)
		if err != nil {
			run = 0
			continue
		}
		if d.Kcal <= 0 || d.Kcal > float64(target) {
			run = 0
			continue
		}
		if run > 0 && t.Equal(prev.AddDate(0, 0, 1)) {
			run++
		} else {
			run = 1
		}
		prev = t
		if run >= 7 {
			return true
		}
	}
	return false
}

type historyDay struct {
	Date  string  `json:"date"`
	Kcal  float64 `json:"kcal"`
	Meals int     `json:"meals"`
}

type historyResponse struct {
	TargetKcal int          `json:"target_kcal"`
	Days       []historyDay `json:"days"`
}

// History returns one entry per calendar day ending at `to`, filling unrecorded days with zeros.
func (h *StatsHandler) History(c *echo.Context) error {
	to, ok := parseDate(c.QueryParam("to"))
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "to must be YYYY-MM-DD")
	}
	n := 7
	if v := c.QueryParam("days"); v != "" {
		parsed, err := strconv.Atoi(v)
		if err != nil || parsed < 1 || parsed > maxHistoryDays {
			return echo.NewHTTPError(http.StatusBadRequest, "days must be between 1 and 31")
		}
		n = parsed
	}

	end, err := time.Parse(dateLayout, to)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "to must be YYYY-MM-DD")
	}
	from := end.AddDate(0, 0, -(n - 1)).Format(dateLayout)

	ctx := c.Request().Context()
	userID := auth.UserID(c)
	summaries, err := loadDaySummaries(ctx, h.DB, userID, from, to)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load history")
	}
	byDate := make(map[string]daySummary, len(summaries))
	for _, s := range summaries {
		byDate[s.Date] = s
	}

	days := make([]historyDay, 0, n)
	for i := n - 1; i >= 0; i-- {
		d := end.AddDate(0, 0, -i).Format(dateLayout)
		s := byDate[d]
		days = append(days, historyDay{Date: d, Kcal: s.Kcal, Meals: s.Meals})
	}
	return c.JSON(http.StatusOK, historyResponse{TargetKcal: loadTarget(ctx, h.DB, userID), Days: days})
}

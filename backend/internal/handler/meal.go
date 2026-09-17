package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/model"
)

const (
	maxMealTextLength = 1000
	maxMealItems      = 30
)

type MealHandler struct {
	DB       *gorm.DB
	Analyzer ai.Analyzer
}

func NewMealHandler(db *gorm.DB, analyzer ai.Analyzer) *MealHandler {
	return &MealHandler{DB: db, Analyzer: analyzer}
}

type analyzeRequest struct {
	Text string `json:"text"`
}

func (h *MealHandler) Analyze(c *echo.Context) error {
	var req analyzeRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "text is required")
	}
	if utf8.RuneCountInString(text) > maxMealTextLength {
		return echo.NewHTTPError(http.StatusBadRequest, "text is too long")
	}

	result, err := h.Analyzer.AnalyzeMeal(c.Request().Context(), text)
	if err != nil {
		slog.Error("meal analysis failed", "error", err)
		return echo.NewHTTPError(http.StatusBadGateway, "AI解析に失敗しました。もう一度お試しください。")
	}
	return c.JSON(http.StatusOK, result)
}

type totals struct {
	Kcal    float64 `json:"kcal"`
	Protein float64 `json:"protein"`
	Fat     float64 `json:"fat"`
	Carbs   float64 `json:"carbs"`
	Salt    float64 `json:"salt"`
	Sugar   float64 `json:"sugar"`
}

type dayResponse struct {
	Date       string       `json:"date"`
	TargetKcal int          `json:"target_kcal"`
	Totals     totals       `json:"totals"`
	Meals      []model.Meal `json:"meals"`
}

func (h *MealHandler) GetDay(c *echo.Context) error {
	date, ok := parseDate(c.Param("date"))
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	ctx := c.Request().Context()
	userID := auth.UserID(c)

	var meals []model.Meal
	if err := h.DB.WithContext(ctx).
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("position") }).
		Where("user_id = ? AND date = ?", userID, date).Order("id").Find(&meals).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch meals")
	}

	var t totals
	for _, m := range meals {
		for _, it := range m.Items {
			t.Kcal += it.Kcal
			t.Protein += it.Protein
			t.Fat += it.Fat
			t.Carbs += it.Carbs
			t.Salt += it.Salt
			t.Sugar += it.Sugar
		}
	}

	target := 0
	var p model.Profile
	if err := h.DB.WithContext(ctx).Where("user_id = ?", userID).First(&p).Error; err == nil {
		target = p.TargetKcal()
	}

	if meals == nil {
		meals = []model.Meal{}
	}
	return c.JSON(http.StatusOK, dayResponse{Date: date, TargetKcal: target, Totals: t, Meals: meals})
}

type upsertMealRequest struct {
	Source string    `json:"source"`
	Items  []ai.Item `json:"items"`
}

func (h *MealHandler) Upsert(c *echo.Context) error {
	date, ok := parseDate(c.Param("date"))
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	slot := c.Param("slot")
	if !model.IsValidSlot(slot) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid slot")
	}

	var req upsertMealRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if len(req.Items) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "items must not be empty")
	}
	if len(req.Items) > maxMealItems {
		return echo.NewHTTPError(http.StatusBadRequest, "too many items")
	}
	items := make([]model.MealItem, 0, len(req.Items))
	for i, it := range req.Items {
		name := strings.TrimSpace(it.Name)
		if name == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "item name is required")
		}
		conf := it.Confidence
		if conf != model.ConfidenceHigh && conf != model.ConfidenceLow {
			conf = model.ConfidenceMid
		}
		items = append(items, model.MealItem{
			Position: i, Name: name, Detail: strings.TrimSpace(it.Detail),
			Kcal: it.Kcal, Protein: it.Protein, Fat: it.Fat, Carbs: it.Carbs,
			Salt: it.Salt, Sugar: it.Sugar, Confidence: conf,
		})
	}
	source := strings.TrimSpace(req.Source)
	if source == "" {
		source = "manual"
	}

	ctx := c.Request().Context()
	userID := auth.UserID(c)
	var saved model.Meal
	err := h.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var meal model.Meal
		err := tx.Where("user_id = ? AND date = ? AND slot = ?", userID, date, slot).First(&meal).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if meal.ID != 0 {
			if err := tx.Where("meal_id = ?", meal.ID).Delete(&model.MealItem{}).Error; err != nil {
				return err
			}
		}
		meal.UserID = userID
		meal.Date = date
		meal.Slot = slot
		meal.Source = source
		meal.RecordedAt = time.Now()
		meal.Items = items
		if err := tx.Save(&meal).Error; err != nil {
			return err
		}
		saved = meal
		return nil
	})
	if err != nil {
		slog.Error("failed to save meal", "error", err)
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save meal")
	}
	return c.JSON(http.StatusOK, saved)
}

func (h *MealHandler) Delete(c *echo.Context) error {
	date, ok := parseDate(c.Param("date"))
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	slot := c.Param("slot")
	if !model.IsValidSlot(slot) {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid slot")
	}
	res := h.DB.WithContext(c.Request().Context()).
		Where("user_id = ? AND date = ? AND slot = ?", auth.UserID(c), date, slot).
		Delete(&model.Meal{})
	if res.Error != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete meal")
	}
	if res.RowsAffected == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "meal not found")
	}
	return c.NoContent(http.StatusNoContent)
}

func parseDate(s string) (string, bool) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return "", false
	}
	return t.Format("2006-01-02"), true
}

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
	// Photos are downscaled in the browser to ~640px JPEG (tens of KB); this is a generous ceiling.
	maxPhotoBytes = 700_000
)

var photoPrefixes = []string{"data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"}

type MealHandler struct {
	DB *gorm.DB
	AI ai.Service
}

func NewMealHandler(db *gorm.DB, svc ai.Service) *MealHandler {
	return &MealHandler{DB: db, AI: svc}
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

	result, err := h.AI.AnalyzeMeal(c.Request().Context(), text)
	if err != nil {
		return aiError(err, "meal analysis", "AI解析に失敗しました。もう一度お試しください。")
	}
	return c.JSON(http.StatusOK, result)
}

func (h *MealHandler) GetDay(c *echo.Context) error {
	date, ok := parseDate(c.Param("date"))
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	day, err := loadDay(c.Request().Context(), h.DB, auth.UserID(c), date)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch meals")
	}
	return c.JSON(http.StatusOK, day)
}

type upsertMealRequest struct {
	Source string    `json:"source"`
	Items  []ai.Item `json:"items"`
	// Photo: omitted keeps the current photo, "" removes it, a data URL replaces it.
	Photo *string `json:"photo"`
	// Cost in yen: omitted keeps the current amount, a value replaces it.
	Cost *int `json:"cost"`
}

func validPhoto(p string) bool {
	if p == "" {
		return true
	}
	if len(p) > maxPhotoBytes {
		return false
	}
	for _, prefix := range photoPrefixes {
		if strings.HasPrefix(p, prefix) {
			return true
		}
	}
	return false
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
	if req.Photo != nil && !validPhoto(*req.Photo) {
		return echo.NewHTTPError(http.StatusBadRequest, "photo must be a JPEG/PNG/WebP data URL under 700KB")
	}
	if req.Cost != nil && (*req.Cost < 0 || *req.Cost > model.MaxYen) {
		return echo.NewHTTPError(http.StatusBadRequest, "cost must be between 0 and 10000000")
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
		source = model.SourceManual
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
		if req.Photo != nil {
			meal.Photo = *req.Photo
		}
		if req.Cost != nil {
			meal.Cost = *req.Cost
		}
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

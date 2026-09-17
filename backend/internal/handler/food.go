package handler

import (
	"net/http"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/model"
)

const (
	maxSearchQueryLen  = 100
	frequentFoodsLimit = 6
	frequentScanLimit  = 500
)

// FoodHandler finds foods to add to a meal: AI search and the user's frequently recorded items.
type FoodHandler struct {
	DB *gorm.DB
	AI ai.Service
}

func NewFoodHandler(db *gorm.DB, svc ai.Service) *FoodHandler {
	return &FoodHandler{DB: db, AI: svc}
}

type itemsResponse struct {
	Items []ai.Item `json:"items"`
}

type searchFoodsRequest struct {
	Query string `json:"query"`
}

// Search asks the AI for candidate foods matching a free-text query.
func (h *FoodHandler) Search(c *echo.Context) error {
	var req searchFoodsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	q := strings.TrimSpace(req.Query)
	if q == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "query is required")
	}
	if utf8.RuneCountInString(q) > maxSearchQueryLen {
		return echo.NewHTTPError(http.StatusBadRequest, "query is too long")
	}
	items, err := h.AI.SearchFoods(c.Request().Context(), q)
	if err != nil {
		return aiError(err, "food search", "検索に失敗しました。もう一度お試しください。")
	}
	if items == nil {
		items = []ai.Item{}
	}
	return c.JSON(http.StatusOK, itemsResponse{Items: items})
}

// Frequent returns the items the user has recorded most often, with their most recent nutrient values.
func (h *FoodHandler) Frequent(c *echo.Context) error {
	var rows []model.MealItem
	if err := h.DB.WithContext(c.Request().Context()).
		Model(&model.MealItem{}).
		Select("meal_items.*").
		Joins("JOIN meals ON meals.id = meal_items.meal_id").
		Where("meals.user_id = ?", auth.UserID(c)).
		Order("meals.recorded_at DESC, meal_items.position").
		Limit(frequentScanLimit).
		Find(&rows).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load frequent foods")
	}

	type entry struct {
		item  ai.Item
		count int
		order int
	}
	byName := map[string]*entry{}
	for i, r := range rows {
		if e, ok := byName[r.Name]; ok {
			e.count++
			continue
		}
		byName[r.Name] = &entry{order: i, count: 1, item: ai.Item{
			Name: r.Name, Detail: r.Detail, Kcal: r.Kcal, Protein: r.Protein, Fat: r.Fat,
			Carbs: r.Carbs, Salt: r.Salt, Sugar: r.Sugar, Confidence: r.Confidence,
		}}
	}
	entries := make([]*entry, 0, len(byName))
	for _, e := range byName {
		entries = append(entries, e)
	}
	sort.Slice(entries, func(a, b int) bool {
		if entries[a].count != entries[b].count {
			return entries[a].count > entries[b].count
		}
		return entries[a].order < entries[b].order
	})

	items := make([]ai.Item, 0, frequentFoodsLimit)
	for _, e := range entries {
		if len(items) == frequentFoodsLimit {
			break
		}
		items = append(items, e.item)
	}
	return c.JSON(http.StatusOK, itemsResponse{Items: items})
}

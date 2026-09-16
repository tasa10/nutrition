package handler

import (
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"nutrition/backend/internal/model"
)

const maxFoodNameLength = 255

type FoodHandler struct {
	DB *gorm.DB
}

func NewFoodHandler(db *gorm.DB) *FoodHandler {
	return &FoodHandler{DB: db}
}

func (h *FoodHandler) List(c *echo.Context) error {
	var foods []model.Food
	if err := h.DB.WithContext(c.Request().Context()).Order("id").Find(&foods).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch foods")
	}
	return c.JSON(http.StatusOK, foods)
}

type createFoodRequest struct {
	Name     string `json:"name"`
	BaseUnit string `json:"base_unit"`
}

func (h *FoodHandler) Create(c *echo.Context) error {
	var req createFoodRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name is required")
	}
	if utf8.RuneCountInString(name) > maxFoodNameLength {
		return echo.NewHTTPError(http.StatusBadRequest, "name is too long")
	}
	if req.BaseUnit != model.BaseUnitPer100g && req.BaseUnit != model.BaseUnitPerServing {
		return echo.NewHTTPError(http.StatusBadRequest, "base_unit must be per_100g or per_serving")
	}

	food := model.Food{
		Name:       name,
		SourceType: model.SourceTypeUser,
		BaseUnit:   req.BaseUnit,
	}
	if err := h.DB.WithContext(c.Request().Context()).Create(&food).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create food")
	}
	return c.JSON(http.StatusCreated, food)
}

package handler

import (
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/model"
)

const (
	maxChatMessages      = 40
	maxChatMessageLength = 1000
)

type ChatHandler struct {
	DB *gorm.DB
	AI ai.Service
}

func NewChatHandler(db *gorm.DB, svc ai.Service) *ChatHandler {
	return &ChatHandler{DB: db, AI: svc}
}

type chatRequest struct {
	// Date is the client's local "today", used to give the coach the day's totals.
	Date     string           `json:"date"`
	Messages []ai.ChatMessage `json:"messages"`
}

func (h *ChatHandler) Post(c *echo.Context) error {
	var req chatRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	date, ok := parseDate(req.Date)
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	if len(req.Messages) == 0 || len(req.Messages) > maxChatMessages {
		return echo.NewHTTPError(http.StatusBadRequest, "messages must contain 1 to 40 entries")
	}
	for _, m := range req.Messages {
		if m.Role != ai.RoleUser && m.Role != ai.RoleAssistant {
			return echo.NewHTTPError(http.StatusBadRequest, "role must be user or assistant")
		}
		if utf8.RuneCountInString(m.Text) > maxChatMessageLength {
			return echo.NewHTTPError(http.StatusBadRequest, "message is too long")
		}
	}
	last := req.Messages[len(req.Messages)-1]
	if last.Role != ai.RoleUser || strings.TrimSpace(last.Text) == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "last message must be a non-empty user message")
	}

	ctx := c.Request().Context()
	day, err := loadDay(ctx, h.DB, auth.UserID(c), date)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load today's meals")
	}
	dc := ai.DayContext{
		TargetKcal: day.TargetKcal,
		Kcal:       day.Totals.Kcal, Protein: day.Totals.Protein, Fat: day.Totals.Fat,
		Carbs: day.Totals.Carbs, Salt: day.Totals.Salt,
	}
	for _, m := range day.Meals {
		names := make([]string, 0, len(m.Items))
		for _, it := range m.Items {
			names = append(names, it.Name)
		}
		dc.Meals = append(dc.Meals, model.SlotLabels[m.Slot]+": "+strings.Join(names, "、"))
	}

	reply, err := h.AI.Chat(ctx, ai.ChatRequest{Messages: req.Messages, Day: dc})
	if err != nil {
		return aiError(err, "chat", "AIの応答に失敗しました。もう一度お試しください。")
	}
	return c.JSON(http.StatusOK, reply)
}

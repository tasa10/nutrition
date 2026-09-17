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
	// Turns sent to the AI per request; older ones add little and cost tokens.
	chatContextTurns     = 30
	chatHistoryLimit     = 200
	maxChatMessageLength = 1000
)

type ChatHandler struct {
	DB *gorm.DB
	AI ai.Service
}

func NewChatHandler(db *gorm.DB, svc ai.Service) *ChatHandler {
	return &ChatHandler{DB: db, AI: svc}
}

type chatHistoryResponse struct {
	Messages []model.ChatMessage `json:"messages"`
}

// Get returns the user's conversation, oldest first (at most the latest chatHistoryLimit turns).
func (h *ChatHandler) Get(c *echo.Context) error {
	var msgs []model.ChatMessage
	if err := h.DB.WithContext(c.Request().Context()).
		Where("user_id = ?", auth.UserID(c)).
		Order("id DESC").Limit(chatHistoryLimit).Find(&msgs).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load chat")
	}
	reverse(msgs)
	return c.JSON(http.StatusOK, chatHistoryResponse{Messages: msgs})
}

type chatRequest struct {
	// Date is the client's local "today", used to give the coach the day's totals.
	Date string `json:"date"`
	Text string `json:"text"`
}

type chatResponse struct {
	Reply    string              `json:"reply"`
	Record   *ai.RecordProposal  `json:"record"`
	Messages []model.ChatMessage `json:"messages"`
}

// Post appends the user's message, asks the coach, and stores both turns.
// Nothing is stored when the AI call fails, so the user can simply resend.
func (h *ChatHandler) Post(c *echo.Context) error {
	var req chatRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	date, ok := parseDate(req.Date)
	if !ok {
		return echo.NewHTTPError(http.StatusBadRequest, "date must be YYYY-MM-DD")
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "text is required")
	}
	if utf8.RuneCountInString(text) > maxChatMessageLength {
		return echo.NewHTTPError(http.StatusBadRequest, "text is too long")
	}

	ctx := c.Request().Context()
	userID := auth.UserID(c)

	var prior []model.ChatMessage
	if err := h.DB.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("id DESC").Limit(chatContextTurns).Find(&prior).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load chat")
	}
	reverse(prior)
	history := make([]ai.ChatMessage, 0, len(prior)+1)
	for _, m := range prior {
		history = append(history, ai.ChatMessage{Role: m.Role, Text: m.Text})
	}
	history = append(history, ai.ChatMessage{Role: ai.RoleUser, Text: text})

	day, err := loadDay(ctx, h.DB, userID, date)
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

	reply, err := h.AI.Chat(ctx, ai.ChatRequest{Messages: history, Day: dc})
	if err != nil {
		return aiError(err, "chat", "AIの応答に失敗しました。もう一度お試しください。")
	}

	stored := []model.ChatMessage{
		{UserID: userID, Role: model.ChatRoleUser, Text: text},
		{UserID: userID, Role: model.ChatRoleAssistant, Text: reply.Reply},
	}
	if err := h.DB.WithContext(ctx).Create(&stored).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save chat")
	}
	return c.JSON(http.StatusOK, chatResponse{Reply: reply.Reply, Record: reply.Record, Messages: stored})
}

type chatNoteRequest struct {
	Text string `json:"text"`
}

// PostNote stores a coach-side line the app writes itself (e.g. after a record card is accepted).
func (h *ChatHandler) PostNote(c *echo.Context) error {
	var req chatNoteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	text := strings.TrimSpace(req.Text)
	if text == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "text is required")
	}
	if utf8.RuneCountInString(text) > maxChatMessageLength {
		return echo.NewHTTPError(http.StatusBadRequest, "text is too long")
	}
	msg := model.ChatMessage{UserID: auth.UserID(c), Role: model.ChatRoleAssistant, Text: text}
	if err := h.DB.WithContext(c.Request().Context()).Create(&msg).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save chat")
	}
	return c.JSON(http.StatusCreated, msg)
}

// Clear deletes the user's whole conversation.
func (h *ChatHandler) Clear(c *echo.Context) error {
	if err := h.DB.WithContext(c.Request().Context()).
		Where("user_id = ?", auth.UserID(c)).Delete(&model.ChatMessage{}).Error; err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to clear chat")
	}
	return c.NoContent(http.StatusNoContent)
}

func reverse(msgs []model.ChatMessage) {
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
}

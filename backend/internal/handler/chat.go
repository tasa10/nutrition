package handler

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/auth"
	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/usecase"
)

type ChatHandler struct {
	uc usecase.ChatUsecase
}

func NewChatHandler(uc usecase.ChatUsecase) *ChatHandler {
	return &ChatHandler{uc: uc}
}

type chatHistoryResponse struct {
	Messages []model.ChatMessage `json:"messages"`
}

func (h *ChatHandler) Get(c *echo.Context) error {
	msgs, err := h.uc.History(c.Request().Context(), auth.UserID(c))
	if err != nil {
		return httpError(err, "failed to load chat")
	}
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

func (h *ChatHandler) Post(c *echo.Context) error {
	var req chatRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	date, err := parseDate(req.Date)
	if err != nil {
		return err
	}
	res, err := h.uc.Send(c.Request().Context(), auth.UserID(c), date, req.Text)
	if errors.Is(err, usecase.ErrAI) {
		return aiError(err, "chat", "AIの応答に失敗しました。もう一度お試しください。")
	}
	if err != nil {
		return httpError(err, "failed to process chat")
	}
	return c.JSON(http.StatusOK, chatResponse{Reply: res.Reply, Record: res.Record, Messages: res.Messages})
}

type chatNoteRequest struct {
	Text string `json:"text"`
}

func (h *ChatHandler) PostNote(c *echo.Context) error {
	var req chatNoteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	msg, err := h.uc.AddNote(c.Request().Context(), auth.UserID(c), req.Text)
	if err != nil {
		return httpError(err, "failed to save chat")
	}
	return c.JSON(http.StatusCreated, msg)
}

func (h *ChatHandler) Clear(c *echo.Context) error {
	if err := h.uc.Clear(c.Request().Context(), auth.UserID(c)); err != nil {
		return httpError(err, "failed to clear chat")
	}
	return c.NoContent(http.StatusNoContent)
}

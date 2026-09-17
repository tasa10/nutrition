package ai

import (
	"context"
	"errors"
	"strings"

	"nutrition/backend/internal/model"
)

// ErrRateLimited means the AI provider rejected the call for quota/rate reasons (HTTP 429).
var ErrRateLimited = errors.New("AI provider rate limit exceeded")

// ErrUnavailable means the AI provider is overloaded or temporarily down (HTTP 5xx / 529) even after retries.
var ErrUnavailable = errors.New("AI provider temporarily unavailable")

var (
	errHistoryNotUser = errors.New("chat history must end with a user message")
	errEmptyAnalysis  = errors.New("analysis returned no items")
)

type Item struct {
	Name       string  `json:"name"`
	Detail     string  `json:"detail"`
	Kcal       float64 `json:"kcal"`
	Protein    float64 `json:"protein"`
	Fat        float64 `json:"fat"`
	Carbs      float64 `json:"carbs"`
	Salt       float64 `json:"salt"`
	Sugar      float64 `json:"sugar"`
	Confidence string  `json:"confidence"`
}

type Analysis struct {
	Items  []Item `json:"items"`
	Advice string `json:"advice"`
}

const (
	RoleUser      = "user"
	RoleAssistant = "assistant"
)

type ChatMessage struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

// DayContext is what the coach knows about the user's day when replying.
type DayContext struct {
	TargetKcal int
	Kcal       float64
	Protein    float64
	Fat        float64
	Carbs      float64
	Salt       float64
	Meals      []string
}

type ChatRequest struct {
	Messages []ChatMessage
	Day      DayContext
}

// RecordProposal is a meal the coach suggests recording, shown as a confirm card.
type RecordProposal struct {
	Name  string  `json:"name"`
	Kcal  float64 `json:"kcal"`
	Slot  string  `json:"slot"`
	Items []Item  `json:"items"`
}

type ChatReply struct {
	Reply  string          `json:"reply"`
	Record *RecordProposal `json:"record"`
}

// Service is the AI surface the app needs. Implementations: Claude (claude.go), Stub (stub.go).
type Service interface {
	AnalyzeMeal(ctx context.Context, text string) (*Analysis, error)
	Chat(ctx context.Context, req ChatRequest) (*ChatReply, error)
	SearchFoods(ctx context.Context, query string) ([]Item, error)
}

// NormalizeHistory drops leading assistant turns (chat APIs expect the user to speak first)
// and merges consecutive turns from the same role.
func NormalizeHistory(msgs []ChatMessage) []ChatMessage {
	out := make([]ChatMessage, 0, len(msgs))
	for _, m := range msgs {
		text := strings.TrimSpace(m.Text)
		if text == "" {
			continue
		}
		if len(out) == 0 && m.Role != RoleUser {
			continue
		}
		if n := len(out); n > 0 && out[n-1].Role == m.Role {
			out[n-1].Text += "\n" + text
			continue
		}
		out = append(out, ChatMessage{Role: m.Role, Text: text})
	}
	return out
}

func normalizeItems(items []Item) []Item {
	out := items[:0]
	for _, it := range items {
		it.Name = strings.TrimSpace(it.Name)
		if it.Name == "" {
			continue
		}
		switch it.Confidence {
		case model.ConfidenceHigh, model.ConfidenceMid, model.ConfidenceLow:
		default:
			it.Confidence = model.ConfidenceMid
		}
		out = append(out, it)
	}
	return out
}

func normalizeReply(r *ChatReply) {
	p := r.Record
	if p == nil {
		return
	}
	if !model.IsValidSlot(p.Slot) {
		p.Slot = model.SlotDinner
	}
	p.Items = normalizeItems(p.Items)
	if len(p.Items) == 0 {
		if strings.TrimSpace(p.Name) == "" {
			r.Record = nil
			return
		}
		p.Items = []Item{{Name: p.Name, Detail: "1人前", Kcal: p.Kcal, Confidence: model.ConfidenceMid}}
	}
	var total float64
	for _, it := range p.Items {
		total += it.Kcal
	}
	p.Kcal = total
}

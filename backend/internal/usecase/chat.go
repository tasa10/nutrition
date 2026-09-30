package usecase

import (
	"context"
	"strings"
	"unicode/utf8"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
)

const (
	// Turns sent to the AI per request; older ones add little and cost tokens.
	chatContextTurns     = 30
	chatHistoryLimit     = 200
	maxChatMessageLength = 1000
)

// ChatUsecase is the coaching conversation: one per user, stored turn by turn.
type ChatUsecase interface {
	// History returns the user's conversation, oldest first (at most the latest chatHistoryLimit turns).
	History(ctx context.Context, userID uint) ([]model.ChatMessage, error)
	// Send asks the coach about text, giving it the recent conversation and the totals for date,
	// and stores both turns. Nothing is stored when the AI call fails, so the user can simply resend.
	Send(ctx context.Context, userID uint, date, text string) (*ChatResult, error)
	// AddNote stores a coach-side line the app writes itself (e.g. after a record card is accepted).
	AddNote(ctx context.Context, userID uint, text string) (*model.ChatMessage, error)
	// Clear deletes the user's whole conversation.
	Clear(ctx context.Context, userID uint) error
}

type chatUsecase struct {
	chats    repository.ChatRepository
	meals    repository.MealRepository
	profiles repository.ProfileRepository
	ai       ai.Service
}

func NewChatUsecase(chats repository.ChatRepository, meals repository.MealRepository, profiles repository.ProfileRepository, svc ai.Service) ChatUsecase {
	return &chatUsecase{chats: chats, meals: meals, profiles: profiles, ai: svc}
}

func (u *chatUsecase) History(ctx context.Context, userID uint) ([]model.ChatMessage, error) {
	return u.chats.ListRecent(ctx, userID, chatHistoryLimit)
}

type ChatResult struct {
	Reply  string
	Record *ai.RecordProposal
	// Messages are the two turns just stored: the user's and the coach's.
	Messages []model.ChatMessage
}

func (u *chatUsecase) Send(ctx context.Context, userID uint, date, text string) (*ChatResult, error) {
	text, err := chatText(text)
	if err != nil {
		return nil, err
	}

	prior, err := u.chats.ListRecent(ctx, userID, chatContextTurns)
	if err != nil {
		return nil, err
	}
	history := make([]ai.ChatMessage, 0, len(prior)+1)
	for _, m := range prior {
		history = append(history, ai.ChatMessage{Role: m.Role, Text: m.Text})
	}
	history = append(history, ai.ChatMessage{Role: ai.RoleUser, Text: text})

	day, err := loadDay(ctx, u.meals, u.profiles, userID, date)
	if err != nil {
		return nil, err
	}

	reply, err := u.ai.Chat(ctx, ai.ChatRequest{Messages: history, Day: dayContext(day)})
	if err != nil {
		return nil, aiFailed(err)
	}

	stored := []model.ChatMessage{
		{UserID: userID, Role: model.ChatRoleUser, Text: text},
		{UserID: userID, Role: model.ChatRoleAssistant, Text: reply.Reply},
	}
	if err := u.chats.Create(ctx, stored); err != nil {
		return nil, err
	}
	return &ChatResult{Reply: reply.Reply, Record: reply.Record, Messages: stored}, nil
}

func (u *chatUsecase) AddNote(ctx context.Context, userID uint, text string) (*model.ChatMessage, error) {
	text, err := chatText(text)
	if err != nil {
		return nil, err
	}
	msgs := []model.ChatMessage{{UserID: userID, Role: model.ChatRoleAssistant, Text: text}}
	if err := u.chats.Create(ctx, msgs); err != nil {
		return nil, err
	}
	return &msgs[0], nil
}

func (u *chatUsecase) Clear(ctx context.Context, userID uint) error {
	return u.chats.DeleteAll(ctx, userID)
}

func chatText(s string) (string, error) {
	text := strings.TrimSpace(s)
	if text == "" {
		return "", invalid("text is required")
	}
	if utf8.RuneCountInString(text) > maxChatMessageLength {
		return "", invalid("text is too long")
	}
	return text, nil
}

func dayContext(day *Day) ai.DayContext {
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
	return dc
}

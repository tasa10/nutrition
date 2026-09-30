package usecase

import (
	"context"
	"errors"
	"testing"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
)

type fakeChatRepo struct {
	msgs []model.ChatMessage
}

func (r *fakeChatRepo) ListRecent(_ context.Context, _ uint, limit int) ([]model.ChatMessage, error) {
	if len(r.msgs) > limit {
		return r.msgs[len(r.msgs)-limit:], nil
	}
	return r.msgs, nil
}

func (r *fakeChatRepo) Create(_ context.Context, msgs []model.ChatMessage) error {
	r.msgs = append(r.msgs, msgs...)
	return nil
}

func (r *fakeChatRepo) DeleteAll(context.Context, uint) error {
	r.msgs = nil
	return nil
}

// fakeMealRepo embeds the interface so tests only implement what they call.
type fakeMealRepo struct {
	repository.MealRepository
	meals []model.Meal
}

func (r *fakeMealRepo) ListByDate(context.Context, uint, string) ([]model.Meal, error) {
	return r.meals, nil
}

type fakeProfileRepo struct {
	repository.ProfileRepository
}

func (fakeProfileRepo) FindByUserID(context.Context, uint) (*model.Profile, error) {
	return nil, repository.ErrNotFound
}

type fakeAI struct {
	ai.Service
	got   ai.ChatRequest
	reply string
	err   error
}

func (f *fakeAI) Chat(_ context.Context, req ai.ChatRequest) (*ai.ChatReply, error) {
	f.got = req
	if f.err != nil {
		return nil, f.err
	}
	return &ai.ChatReply{Reply: f.reply}, nil
}

func TestChatSendStoresBothTurnsWithDayContext(t *testing.T) {
	chats := &fakeChatRepo{msgs: []model.ChatMessage{{Role: model.ChatRoleAssistant, Text: "こんにちは"}}}
	meals := &fakeMealRepo{meals: []model.Meal{{Slot: model.SlotLunch, Items: []model.MealItem{
		{Name: "カレー", Kcal: 700}, {Name: "サラダ", Kcal: 50},
	}}}}
	svc := &fakeAI{reply: "いいですね"}
	uc := NewChatUsecase(chats, meals, fakeProfileRepo{}, svc)

	res, err := uc.Send(context.Background(), 1, "2026-09-30", "  夜は何を食べる？ ")
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if res.Reply != "いいですね" || len(res.Messages) != 2 {
		t.Fatalf("unexpected result: %+v", res)
	}
	if len(chats.msgs) != 3 || chats.msgs[1].Text != "夜は何を食べる？" || chats.msgs[2].Role != model.ChatRoleAssistant {
		t.Fatalf("unexpected stored messages: %+v", chats.msgs)
	}
	if n := len(svc.got.Messages); n != 2 || svc.got.Messages[n-1].Role != ai.RoleUser {
		t.Fatalf("history sent to AI should end with the user's turn: %+v", svc.got.Messages)
	}
	if svc.got.Day.Kcal != 750 || len(svc.got.Day.Meals) != 1 || svc.got.Day.Meals[0] != "昼食: カレー、サラダ" {
		t.Fatalf("unexpected day context: %+v", svc.got.Day)
	}
}

func TestChatSendStoresNothingWhenAIFails(t *testing.T) {
	chats := &fakeChatRepo{}
	svc := &fakeAI{err: ai.ErrRateLimited}
	uc := NewChatUsecase(chats, &fakeMealRepo{}, fakeProfileRepo{}, svc)

	_, err := uc.Send(context.Background(), 1, "2026-09-30", "こんにちは")
	if !errors.Is(err, ErrAI) || !errors.Is(err, ai.ErrRateLimited) {
		t.Fatalf("want ErrAI wrapping ErrRateLimited, got %v", err)
	}
	if len(chats.msgs) != 0 {
		t.Fatalf("nothing should be stored, got %+v", chats.msgs)
	}
}

func TestChatSendRejectsBlankText(t *testing.T) {
	uc := NewChatUsecase(&fakeChatRepo{}, &fakeMealRepo{}, fakeProfileRepo{}, &fakeAI{})

	_, err := uc.Send(context.Background(), 1, "2026-09-30", "   ")
	var ve *ValidationError
	if !errors.As(err, &ve) || ve.Msg != "text is required" {
		t.Fatalf("want validation error, got %v", err)
	}
}

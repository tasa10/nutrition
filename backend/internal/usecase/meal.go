package usecase

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
)

const (
	maxMealTextLength = 1000
	maxMealItems      = 30
	// Photos are downscaled in the browser to ~640px JPEG (tens of KB); this is a generous ceiling.
	maxPhotoBytes = 700_000
)

var photoPrefixes = []string{"data:image/jpeg;base64,", "data:image/png;base64,", "data:image/webp;base64,"}

// MealUsecase records what the user ate, one meal per slot per day.
type MealUsecase interface {
	// Analyze asks the AI to break a free-text meal description into items with nutrients.
	Analyze(ctx context.Context, text string) (*ai.Analysis, error)
	// Day returns the day's meals and nutrient totals.
	Day(ctx context.Context, userID uint, date string) (*Day, error)
	// Upsert records (or replaces) the meal in one slot of one day.
	Upsert(ctx context.Context, userID uint, date, slot string, in UpsertMealInput) (*model.Meal, error)
	// Delete removes the meal in one slot of one day; repository.ErrNotFound if there is none.
	Delete(ctx context.Context, userID uint, date, slot string) error
}

type mealUsecase struct {
	meals    repository.MealRepository
	profiles repository.ProfileRepository
	ai       ai.Service
}

func NewMealUsecase(meals repository.MealRepository, profiles repository.ProfileRepository, svc ai.Service) MealUsecase {
	return &mealUsecase{meals: meals, profiles: profiles, ai: svc}
}

func (u *mealUsecase) Analyze(ctx context.Context, text string) (*ai.Analysis, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, invalid("text is required")
	}
	if utf8.RuneCountInString(text) > maxMealTextLength {
		return nil, invalid("text is too long")
	}
	result, err := u.ai.AnalyzeMeal(ctx, text)
	if err != nil {
		return nil, aiFailed(err)
	}
	return result, nil
}

func (u *mealUsecase) Day(ctx context.Context, userID uint, date string) (*Day, error) {
	return loadDay(ctx, u.meals, u.profiles, userID, date)
}

type UpsertMealInput struct {
	Source string
	Items  []ai.Item
	// Photo: nil keeps the current photo, "" removes it, a data URL replaces it.
	Photo *string
	// Cost in yen: nil keeps the current amount, a value replaces it.
	Cost *int
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

func (u *mealUsecase) Upsert(ctx context.Context, userID uint, date, slot string, in UpsertMealInput) (*model.Meal, error) {
	if !model.IsValidSlot(slot) {
		return nil, invalid("invalid slot")
	}
	if len(in.Items) == 0 {
		return nil, invalid("items must not be empty")
	}
	if len(in.Items) > maxMealItems {
		return nil, invalid("too many items")
	}
	if in.Photo != nil && !validPhoto(*in.Photo) {
		return nil, invalid("photo must be a JPEG/PNG/WebP data URL under 700KB")
	}
	if in.Cost != nil && !validYen(*in.Cost) {
		return nil, invalid("cost must be between 0 and 10000000")
	}
	items := make([]model.MealItem, 0, len(in.Items))
	for i, it := range in.Items {
		name := strings.TrimSpace(it.Name)
		if name == "" {
			return nil, invalid("item name is required")
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
	source := strings.TrimSpace(in.Source)
	if source == "" {
		source = model.SourceManual
	}

	return u.meals.Upsert(ctx, userID, date, slot, func(m *model.Meal) {
		m.Source = source
		if in.Photo != nil {
			m.Photo = *in.Photo
		}
		if in.Cost != nil {
			m.Cost = *in.Cost
		}
		m.RecordedAt = time.Now()
		m.Items = items
	})
}

func (u *mealUsecase) Delete(ctx context.Context, userID uint, date, slot string) error {
	if !model.IsValidSlot(slot) {
		return invalid("invalid slot")
	}
	return u.meals.Delete(ctx, userID, date, slot)
}

package usecase

import (
	"context"
	"time"

	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
)

// DateLayout is how dates travel through the API and are stored: the user's local calendar day.
const DateLayout = "2006-01-02"

// ParseDate validates a YYYY-MM-DD date and returns it in canonical form.
func ParseDate(s string) (string, bool) {
	t, err := time.Parse(DateLayout, s)
	if err != nil {
		return "", false
	}
	return t.Format(DateLayout), true
}

type Totals struct {
	Kcal    float64
	Protein float64
	Fat     float64
	Carbs   float64
	Salt    float64
	Sugar   float64
}

type Day struct {
	Date       string
	TargetKcal int
	Totals     Totals
	Meals      []model.Meal
}

// targetKcal is 0 when the user hasn't set a profile yet (or it can't be read).
func targetKcal(ctx context.Context, profiles repository.ProfileRepository, userID uint) int {
	p, err := profiles.FindByUserID(ctx, userID)
	if err != nil {
		return 0
	}
	return p.TargetKcal()
}

func loadDay(ctx context.Context, meals repository.MealRepository, profiles repository.ProfileRepository, userID uint, date string) (*Day, error) {
	ms, err := meals.ListByDate(ctx, userID, date)
	if err != nil {
		return nil, err
	}
	var t Totals
	for _, m := range ms {
		for _, it := range m.Items {
			t.Kcal += it.Kcal
			t.Protein += it.Protein
			t.Fat += it.Fat
			t.Carbs += it.Carbs
			t.Salt += it.Salt
			t.Sugar += it.Sugar
		}
	}
	if ms == nil {
		ms = []model.Meal{}
	}
	return &Day{Date: date, TargetKcal: targetKcal(ctx, profiles, userID), Totals: t, Meals: ms}, nil
}

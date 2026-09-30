package usecase

import (
	"context"
	"errors"

	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
)

// ProfileUsecase manages the body data the daily calorie target is derived from.
type ProfileUsecase interface {
	// Get returns repository.ErrNotFound until the user finishes onboarding.
	Get(ctx context.Context, userID uint) (*model.Profile, error)
	// Save creates the profile on first use and overwrites it afterwards.
	Save(ctx context.Context, userID uint, in SaveProfileInput) (*model.Profile, error)
}

type profileUsecase struct {
	profiles repository.ProfileRepository
}

func NewProfileUsecase(profiles repository.ProfileRepository) ProfileUsecase {
	return &profileUsecase{profiles: profiles}
}

func (u *profileUsecase) Get(ctx context.Context, userID uint) (*model.Profile, error) {
	return u.profiles.FindByUserID(ctx, userID)
}

type SaveProfileInput struct {
	WeightNow     float64
	WeightGoal    float64
	ActivityLevel int
	// MonthlyBudget in yen: nil keeps the current budget, 0 clears it.
	MonthlyBudget *int
}

func validYen(yen int) bool {
	return yen >= 0 && yen <= model.MaxYen
}

func (u *profileUsecase) Save(ctx context.Context, userID uint, in SaveProfileInput) (*model.Profile, error) {
	if in.WeightNow <= 0 || in.WeightNow > 500 || in.WeightGoal <= 0 || in.WeightGoal > 500 {
		return nil, invalid("weight must be between 0 and 500")
	}
	if in.ActivityLevel < model.ActivityNormal || in.ActivityLevel > model.ActivityHigh {
		return nil, invalid("activity_level must be 0, 1 or 2")
	}
	if in.MonthlyBudget != nil && !validYen(*in.MonthlyBudget) {
		return nil, invalid("monthly_budget must be between 0 and 10000000")
	}

	p, err := u.profiles.FindByUserID(ctx, userID)
	if errors.Is(err, repository.ErrNotFound) {
		p = &model.Profile{UserID: userID}
	} else if err != nil {
		return nil, err
	}
	p.WeightNow = in.WeightNow
	p.WeightGoal = in.WeightGoal
	p.ActivityLevel = in.ActivityLevel
	if in.MonthlyBudget != nil {
		p.MonthlyBudget = *in.MonthlyBudget
	}
	if err := u.profiles.Save(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

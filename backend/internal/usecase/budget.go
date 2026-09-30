package usecase

import (
	"context"
	"errors"
	"time"

	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
)

const monthLayout = "2006-01"

// BudgetUsecase tracks food spending against the monthly budget.
type BudgetUsecase interface {
	// Month sums what the user's meals cost in one calendar month (YYYY-MM), in total and per slot.
	Month(ctx context.Context, userID uint, month string) (*Budget, error)
	// SetMonthly changes only the monthly budget; the rest of the profile is set during onboarding.
	// repository.ErrNotFound if the user has no profile yet.
	SetMonthly(ctx context.Context, userID uint, yen int) error
}

type budgetUsecase struct {
	meals    repository.MealRepository
	profiles repository.ProfileRepository
}

func NewBudgetUsecase(meals repository.MealRepository, profiles repository.ProfileRepository) BudgetUsecase {
	return &budgetUsecase{meals: meals, profiles: profiles}
}

type SlotCost struct {
	Slot string
	Cost int
}

type Budget struct {
	Month         string
	MonthlyBudget int
	Spent         int
	// BySlot always has all four slots, in display order, so the client can render fixed rows.
	BySlot []SlotCost
}

func (u *budgetUsecase) Month(ctx context.Context, userID uint, month string) (*Budget, error) {
	start, err := time.Parse(monthLayout, month)
	if err != nil {
		return nil, invalid("month must be YYYY-MM")
	}
	from := start.Format(DateLayout)
	to := start.AddDate(0, 1, -1).Format(DateLayout)

	costs, err := u.meals.CostBySlot(ctx, userID, from, to)
	if err != nil {
		return nil, err
	}
	spent := 0
	bySlot := make([]SlotCost, 0, len(model.Slots))
	for _, s := range model.Slots {
		bySlot = append(bySlot, SlotCost{Slot: s, Cost: costs[s]})
		spent += costs[s]
	}

	monthly := 0
	p, err := u.profiles.FindByUserID(ctx, userID)
	switch {
	case err == nil:
		monthly = p.MonthlyBudget
	case !errors.Is(err, repository.ErrNotFound):
		return nil, err
	}

	return &Budget{Month: start.Format(monthLayout), MonthlyBudget: monthly, Spent: spent, BySlot: bySlot}, nil
}

func (u *budgetUsecase) SetMonthly(ctx context.Context, userID uint, yen int) error {
	if !validYen(yen) {
		return invalid("monthly_budget must be between 0 and 10000000")
	}
	return u.profiles.UpdateMonthlyBudget(ctx, userID, yen)
}

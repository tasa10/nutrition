package usecase

import (
	"context"
	"sort"
	"strings"
	"unicode/utf8"

	"nutrition/backend/internal/ai"
	"nutrition/backend/internal/domain/repository"
)

const (
	maxSearchQueryLen  = 100
	frequentFoodsLimit = 6
	frequentScanLimit  = 500
)

// FoodUsecase finds foods to add to a meal: AI search and the user's frequently recorded items.
type FoodUsecase interface {
	// Search asks the AI for candidate foods matching a free-text query.
	Search(ctx context.Context, query string) ([]ai.Item, error)
	// Frequent returns the items the user has recorded most often, with their most recent nutrient values.
	Frequent(ctx context.Context, userID uint) ([]ai.Item, error)
}

type foodUsecase struct {
	meals repository.MealRepository
	ai    ai.Service
}

func NewFoodUsecase(meals repository.MealRepository, svc ai.Service) FoodUsecase {
	return &foodUsecase{meals: meals, ai: svc}
}

func (u *foodUsecase) Search(ctx context.Context, query string) ([]ai.Item, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return nil, invalid("query is required")
	}
	if utf8.RuneCountInString(q) > maxSearchQueryLen {
		return nil, invalid("query is too long")
	}
	items, err := u.ai.SearchFoods(ctx, q)
	if err != nil {
		return nil, aiFailed(err)
	}
	if items == nil {
		items = []ai.Item{}
	}
	return items, nil
}

func (u *foodUsecase) Frequent(ctx context.Context, userID uint) ([]ai.Item, error) {
	rows, err := u.meals.ListRecentItems(ctx, userID, frequentScanLimit)
	if err != nil {
		return nil, err
	}

	type entry struct {
		item  ai.Item
		count int
		order int
	}
	byName := map[string]*entry{}
	for i, r := range rows {
		if e, ok := byName[r.Name]; ok {
			e.count++
			continue
		}
		byName[r.Name] = &entry{order: i, count: 1, item: ai.Item{
			Name: r.Name, Detail: r.Detail, Kcal: r.Kcal, Protein: r.Protein, Fat: r.Fat,
			Carbs: r.Carbs, Salt: r.Salt, Sugar: r.Sugar, Confidence: r.Confidence,
		}}
	}
	entries := make([]*entry, 0, len(byName))
	for _, e := range byName {
		entries = append(entries, e)
	}
	sort.Slice(entries, func(a, b int) bool {
		if entries[a].count != entries[b].count {
			return entries[a].count > entries[b].count
		}
		return entries[a].order < entries[b].order
	})

	items := make([]ai.Item, 0, frequentFoodsLimit)
	for _, e := range entries {
		if len(items) == frequentFoodsLimit {
			break
		}
		items = append(items, e.item)
	}
	return items, nil
}

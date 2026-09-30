// Package repository declares how the domain is stored; infrastructure/repository implements it.
package repository

import (
	"context"
	"errors"

	"nutrition/backend/internal/domain/model"
)

// ErrNotFound is returned when the target row doesn't exist.
// Methods that look up or change a single row return it.
var ErrNotFound = errors.New("not found")

type ChatRepository interface {
	// ListRecent returns the user's latest limit messages, oldest first.
	ListRecent(ctx context.Context, userID uint, limit int) ([]model.ChatMessage, error)
	Create(ctx context.Context, msgs []model.ChatMessage) error
	DeleteAll(ctx context.Context, userID uint) error
}

type MealRepository interface {
	// ListByDate returns the day's meals in creation order, each with its items in position order.
	ListByDate(ctx context.Context, userID uint, date string) ([]model.Meal, error)
	// Upsert loads the meal for (user, date, slot) or starts a new one, drops its items,
	// lets apply set the new fields and items, and saves it, all in one transaction.
	Upsert(ctx context.Context, userID uint, date, slot string, apply func(*model.Meal)) (*model.Meal, error)
	Delete(ctx context.Context, userID uint, date, slot string) error
	// ListRecentItems returns up to limit items, newest meal first.
	ListRecentItems(ctx context.Context, userID uint, limit int) ([]model.MealItem, error)
	CountBySource(ctx context.Context, userID uint) (map[string]int, error)
	// DaySummaries returns only days in [from, to] that have at least one meal, oldest first.
	DaySummaries(ctx context.Context, userID uint, from, to string) ([]model.DaySummary, error)
	CostBySlot(ctx context.Context, userID uint, from, to string) (map[string]int, error)
}

type ProfileRepository interface {
	FindByUserID(ctx context.Context, userID uint) (*model.Profile, error)
	Save(ctx context.Context, p *model.Profile) error
	UpdateMonthlyBudget(ctx context.Context, userID uint, yen int) error
}

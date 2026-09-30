package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"nutrition/backend/internal/domain/model"
	domainrepo "nutrition/backend/internal/domain/repository"
)

type MealRepository struct {
	db *gorm.DB
}

var _ domainrepo.MealRepository = (*MealRepository)(nil)

func NewMealRepository(db *gorm.DB) *MealRepository {
	return &MealRepository{db: db}
}

func (r *MealRepository) ListByDate(ctx context.Context, userID uint, date string) ([]model.Meal, error) {
	var meals []model.Meal
	if err := r.db.WithContext(ctx).
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("position") }).
		Where("user_id = ? AND date = ?", userID, date).Order("id").Find(&meals).Error; err != nil {
		return nil, err
	}
	return meals, nil
}

func (r *MealRepository) Upsert(ctx context.Context, userID uint, date, slot string, apply func(*model.Meal)) (*model.Meal, error) {
	var saved model.Meal
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var meal model.Meal
		err := tx.Where("user_id = ? AND date = ? AND slot = ?", userID, date, slot).First(&meal).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if meal.ID != 0 {
			if err := tx.Where("meal_id = ?", meal.ID).Delete(&model.MealItem{}).Error; err != nil {
				return err
			}
		}
		meal.UserID = userID
		meal.Date = date
		meal.Slot = slot
		apply(&meal)
		if err := tx.Save(&meal).Error; err != nil {
			return err
		}
		saved = meal
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &saved, nil
}

func (r *MealRepository) Delete(ctx context.Context, userID uint, date, slot string) error {
	res := r.db.WithContext(ctx).
		Where("user_id = ? AND date = ? AND slot = ?", userID, date, slot).
		Delete(&model.Meal{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domainrepo.ErrNotFound
	}
	return nil
}

func (r *MealRepository) ListRecentItems(ctx context.Context, userID uint, limit int) ([]model.MealItem, error) {
	var rows []model.MealItem
	if err := r.db.WithContext(ctx).
		Model(&model.MealItem{}).
		Select("meal_items.*").
		Joins("JOIN meals ON meals.id = meal_items.meal_id").
		Where("meals.user_id = ?", userID).
		Order("meals.recorded_at DESC, meal_items.position").
		Limit(limit).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *MealRepository) CountBySource(ctx context.Context, userID uint) (map[string]int, error) {
	var rows []struct {
		Source string
		Count  int
	}
	if err := r.db.WithContext(ctx).Model(&model.Meal{}).
		Select("source, COUNT(*) AS count").Where("user_id = ?", userID).Group("source").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	counts := make(map[string]int, len(rows))
	for _, row := range rows {
		counts[row.Source] = row.Count
	}
	return counts, nil
}

// DaySummaries relies on dates being stored as YYYY-MM-DD strings, so lexical BETWEEN is a date range.
// Items are summed per meal first so that m.cost is counted once per meal, not once per item.
func (r *MealRepository) DaySummaries(ctx context.Context, userID uint, from, to string) ([]model.DaySummary, error) {
	var rows []model.DaySummary
	err := r.db.WithContext(ctx).Raw(`
SELECT m.date AS date,
       COUNT(*) AS meals,
       COALESCE(SUM(i.kcal), 0) AS kcal,
       COALESCE(SUM(i.protein), 0) AS protein,
       COALESCE(SUM(i.fat), 0) AS fat,
       COALESCE(SUM(i.carbs), 0) AS carbs,
       COALESCE(SUM(i.salt), 0) AS salt,
       COALESCE(SUM(m.cost), 0) AS cost
FROM meals m
LEFT JOIN (
  SELECT meal_id, SUM(kcal) AS kcal, SUM(protein) AS protein, SUM(fat) AS fat,
         SUM(carbs) AS carbs, SUM(salt) AS salt
  FROM meal_items GROUP BY meal_id
) i ON i.meal_id = m.id
WHERE m.user_id = ? AND m.date BETWEEN ? AND ?
GROUP BY m.date
ORDER BY m.date`, userID, from, to).Scan(&rows).Error
	return rows, err
}

func (r *MealRepository) CostBySlot(ctx context.Context, userID uint, from, to string) (map[string]int, error) {
	var rows []struct {
		Slot string
		Cost int
	}
	if err := r.db.WithContext(ctx).Model(&model.Meal{}).
		Select("slot, COALESCE(SUM(cost), 0) AS cost").
		Where("user_id = ? AND date BETWEEN ? AND ?", userID, from, to).
		Group("slot").Scan(&rows).Error; err != nil {
		return nil, err
	}
	costs := make(map[string]int, len(rows))
	for _, row := range rows {
		costs[row.Slot] = row.Cost
	}
	return costs, nil
}

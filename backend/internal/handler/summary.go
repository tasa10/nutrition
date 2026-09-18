package handler

import (
	"context"
	"time"

	"gorm.io/gorm"

	"nutrition/backend/internal/model"
)

const dateLayout = "2006-01-02"

func parseDate(s string) (string, bool) {
	t, err := time.Parse(dateLayout, s)
	if err != nil {
		return "", false
	}
	return t.Format(dateLayout), true
}

type totals struct {
	Kcal    float64 `json:"kcal"`
	Protein float64 `json:"protein"`
	Fat     float64 `json:"fat"`
	Carbs   float64 `json:"carbs"`
	Salt    float64 `json:"salt"`
	Sugar   float64 `json:"sugar"`
}

type dayResponse struct {
	Date       string       `json:"date"`
	TargetKcal int          `json:"target_kcal"`
	Totals     totals       `json:"totals"`
	Meals      []model.Meal `json:"meals"`
}

func loadTarget(ctx context.Context, db *gorm.DB, userID uint) int {
	var p model.Profile
	if err := db.WithContext(ctx).Where("user_id = ?", userID).First(&p).Error; err != nil {
		return 0
	}
	return p.TargetKcal()
}

func loadDay(ctx context.Context, db *gorm.DB, userID uint, date string) (*dayResponse, error) {
	var meals []model.Meal
	if err := db.WithContext(ctx).
		Preload("Items", func(db *gorm.DB) *gorm.DB { return db.Order("position") }).
		Where("user_id = ? AND date = ?", userID, date).Order("id").Find(&meals).Error; err != nil {
		return nil, err
	}

	var t totals
	for _, m := range meals {
		for _, it := range m.Items {
			t.Kcal += it.Kcal
			t.Protein += it.Protein
			t.Fat += it.Fat
			t.Carbs += it.Carbs
			t.Salt += it.Salt
			t.Sugar += it.Sugar
		}
	}
	if meals == nil {
		meals = []model.Meal{}
	}
	return &dayResponse{Date: date, TargetKcal: loadTarget(ctx, db, userID), Totals: t, Meals: meals}, nil
}

// daySummary is one row of per-day aggregates across a user's meals.
type daySummary struct {
	Date    string  `gorm:"column:date"`
	Meals   int     `gorm:"column:meals"`
	Kcal    float64 `gorm:"column:kcal"`
	Protein float64 `gorm:"column:protein"`
	Fat     float64 `gorm:"column:fat"`
	Carbs   float64 `gorm:"column:carbs"`
	Salt    float64 `gorm:"column:salt"`
	Cost    int     `gorm:"column:cost"`
}

// loadDaySummaries returns only days that have at least one meal, oldest first.
// Dates are stored as YYYY-MM-DD strings, so lexical BETWEEN is a date range.
// Items are summed per meal first so that m.cost is counted once per meal, not once per item.
func loadDaySummaries(ctx context.Context, db *gorm.DB, userID uint, from, to string) ([]daySummary, error) {
	var rows []daySummary
	err := db.WithContext(ctx).Raw(`
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

package model

// DaySummary is one row of per-day aggregates across a user's meals.
type DaySummary struct {
	Date    string  `gorm:"column:date"`
	Meals   int     `gorm:"column:meals"`
	Kcal    float64 `gorm:"column:kcal"`
	Protein float64 `gorm:"column:protein"`
	Fat     float64 `gorm:"column:fat"`
	Carbs   float64 `gorm:"column:carbs"`
	Salt    float64 `gorm:"column:salt"`
	Cost    int     `gorm:"column:cost"`
}

package model

import "time"

const (
	SlotBreakfast = "breakfast"
	SlotLunch     = "lunch"
	SlotDinner    = "dinner"
	SlotSnack     = "snack"
)

var Slots = []string{SlotBreakfast, SlotLunch, SlotDinner, SlotSnack}

func IsValidSlot(s string) bool {
	for _, v := range Slots {
		if v == s {
			return true
		}
	}
	return false
}

const (
	ConfidenceHigh = "high"
	ConfidenceMid  = "mid"
	ConfidenceLow  = "low"
)

// Meal is one eating occasion: a single slot on a single day.
// Nutrient values live on the items, as estimated by the AI at record time.
type Meal struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	Date       string     `gorm:"size:10;not null;uniqueIndex:idx_meals_date_slot" json:"date"`
	Slot       string     `gorm:"size:16;not null;uniqueIndex:idx_meals_date_slot" json:"slot"`
	Source     string     `gorm:"size:32;not null" json:"source"`
	RecordedAt time.Time  `json:"recorded_at"`
	Items      []MealItem `gorm:"constraint:OnDelete:CASCADE" json:"items"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

type MealItem struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	MealID     uint    `gorm:"not null;index" json:"-"`
	Position   int     `gorm:"not null" json:"-"`
	Name       string  `gorm:"size:255;not null" json:"name"`
	Detail     string  `gorm:"size:255" json:"detail"`
	Kcal       float64 `json:"kcal"`
	Protein    float64 `json:"protein"`
	Fat        float64 `json:"fat"`
	Carbs      float64 `json:"carbs"`
	Salt       float64 `json:"salt"`
	Sugar      float64 `json:"sugar"`
	Confidence string  `gorm:"size:8;not null;default:mid" json:"confidence"`
}

package model

import "time"

const (
	SlotBreakfast = "breakfast"
	SlotLunch     = "lunch"
	SlotDinner    = "dinner"
	SlotSnack     = "snack"
)

var Slots = []string{SlotBreakfast, SlotLunch, SlotDinner, SlotSnack}

var SlotLabels = map[string]string{
	SlotBreakfast: "朝食",
	SlotLunch:     "昼食",
	SlotDinner:    "夕食",
	SlotSnack:     "間食",
}

func IsValidSlot(s string) bool {
	_, ok := SlotLabels[s]
	return ok
}

const (
	ConfidenceHigh = "high"
	ConfidenceMid  = "mid"
	ConfidenceLow  = "low"
)

// SourceManual marks items added by hand from search; it earns less XP than voice/chat records.
const SourceManual = "manual"

// Meal is one eating occasion: a single slot on a single day for one user.
// Nutrient values live on the items, as estimated by the AI at record time.
// default:1 on user_id backfills rows created before users existed; drop it once real auth is in.
type Meal struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	UserID     uint       `gorm:"not null;default:1;uniqueIndex:idx_meals_user_date_slot" json:"user_id"`
	Date       string     `gorm:"size:10;not null;uniqueIndex:idx_meals_user_date_slot" json:"date"`
	Slot       string     `gorm:"size:16;not null;uniqueIndex:idx_meals_user_date_slot" json:"slot"`
	Source     string     `gorm:"size:32;not null" json:"source"`
	Photo      string     `gorm:"type:text" json:"photo,omitempty"`
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

package model

import (
	"math"
	"time"
)

const (
	ActivityNormal = 0
	ActivityActive = 1
	ActivityHigh   = 2
)

// Profile holds the body data used to derive the daily calorie target. One per user.
// default:1 backfills rows created before user_id existed; drop it once real auth is in.
type Profile struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"not null;default:1;uniqueIndex" json:"user_id"`
	WeightNow     float64   `gorm:"not null" json:"weight_now"`
	WeightGoal    float64   `gorm:"not null" json:"weight_goal"`
	ActivityLevel int       `gorm:"not null" json:"activity_level"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// TargetKcal mirrors the prototype's heuristic: 22 kcal/kg × activity multiplier,
// minus a 400 kcal deficit when aiming to lose weight, rounded to 10.
func (p Profile) TargetKcal() int {
	mult := [...]float64{1.2, 1.45, 1.7}
	i := p.ActivityLevel
	if i < 0 || i >= len(mult) {
		i = ActivityNormal
	}
	base := p.WeightNow * 22 * mult[i]
	if p.WeightGoal < p.WeightNow {
		base -= 400
	}
	return int(math.Round(base/10) * 10)
}

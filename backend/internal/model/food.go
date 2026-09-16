package model

import "time"

const (
	SourceTypeOfficial = "official"
	SourceTypeUser     = "user"

	BaseUnitPer100g    = "per_100g"
	BaseUnitPerServing = "per_serving"
)

type Food struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Name       string    `gorm:"size:255;not null" json:"name"`
	SourceType string    `gorm:"size:32;not null" json:"source_type"`
	BaseUnit   string    `gorm:"size:32;not null" json:"base_unit"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

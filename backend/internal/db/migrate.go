package db

import (
	"gorm.io/gorm"

	"nutrition/backend/internal/model"
)

func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.Food{}); err != nil {
		return err
	}
	return seedFoods(db)
}

func seedFoods(db *gorm.DB) error {
	var count int64
	if err := db.Model(&model.Food{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	seeds := []model.Food{
		{Name: "白米（炊飯）", SourceType: model.SourceTypeOfficial, BaseUnit: model.BaseUnitPer100g},
		{Name: "鶏むね肉（皮なし）", SourceType: model.SourceTypeOfficial, BaseUnit: model.BaseUnitPer100g},
		{Name: "鶏卵（全卵）", SourceType: model.SourceTypeOfficial, BaseUnit: model.BaseUnitPer100g},
		{Name: "木綿豆腐", SourceType: model.SourceTypeOfficial, BaseUnit: model.BaseUnitPer100g},
		{Name: "バナナ", SourceType: model.SourceTypeOfficial, BaseUnit: model.BaseUnitPer100g},
	}
	return db.Create(&seeds).Error
}

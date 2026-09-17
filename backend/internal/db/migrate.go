package db

import (
	"gorm.io/gorm"

	"nutrition/backend/internal/model"
)

func Migrate(db *gorm.DB) error {
	// Users first so the dev user exists before user_id defaults reference it.
	if err := db.AutoMigrate(&model.User{}); err != nil {
		return err
	}
	if err := seedDevUser(db); err != nil {
		return err
	}

	// meals used to be unique on (date, slot); that index must go before the per-user one takes over.
	if db.Migrator().HasTable(&model.Meal{}) && db.Migrator().HasIndex(&model.Meal{}, "idx_meals_date_slot") {
		if err := db.Migrator().DropIndex(&model.Meal{}, "idx_meals_date_slot"); err != nil {
			return err
		}
	}

	if err := db.AutoMigrate(&model.Food{}, &model.Profile{}, &model.Meal{}, &model.MealItem{}); err != nil {
		return err
	}
	return seedFoods(db)
}

func seedDevUser(db *gorm.DB) error {
	user := model.User{ID: model.DevUserID, FirebaseUID: model.DevUserFirebaseUID, DisplayName: "開発ユーザー"}
	if err := db.Where(model.User{ID: model.DevUserID}).FirstOrCreate(&user).Error; err != nil {
		return err
	}
	// Inserting an explicit id does not advance the serial; resync so future signups don't collide with it.
	return db.Exec("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users))").Error
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

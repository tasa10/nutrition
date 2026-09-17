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

	// The early food master table is no longer used; nutrients now live on meal_items.
	if err := db.Migrator().DropTable("foods"); err != nil {
		return err
	}

	return db.AutoMigrate(&model.Profile{}, &model.Meal{}, &model.MealItem{}, &model.ChatMessage{})
}

func seedDevUser(db *gorm.DB) error {
	user := model.User{ID: model.DevUserID, FirebaseUID: model.DevUserFirebaseUID, DisplayName: "開発ユーザー"}
	if err := db.Where(model.User{ID: model.DevUserID}).FirstOrCreate(&user).Error; err != nil {
		return err
	}
	// Inserting an explicit id does not advance the serial; resync so future signups don't collide with it.
	return db.Exec("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users))").Error
}

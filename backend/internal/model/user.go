package model

import "time"

// DevUserID is the user the dev authenticator signs in as until Firebase Auth lands.
const DevUserID uint = 1

const DevUserFirebaseUID = "dev-user-1"

type User struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	FirebaseUID string    `gorm:"size:128;not null;uniqueIndex" json:"firebase_uid"`
	DisplayName string    `gorm:"size:255" json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

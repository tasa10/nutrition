package model

import "time"

const (
	ChatRoleUser      = "user"
	ChatRoleAssistant = "assistant"
)

// ChatMessage is one turn of the user's coaching conversation. One conversation per user.
type ChatMessage struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"-"`
	Role      string    `gorm:"size:16;not null" json:"role"`
	Text      string    `gorm:"type:text;not null" json:"text"`
	CreatedAt time.Time `json:"created_at"`
}

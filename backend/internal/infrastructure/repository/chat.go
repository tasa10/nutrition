// Package repository implements the domain repositories on PostgreSQL via GORM.
package repository

import (
	"context"
	"slices"

	"gorm.io/gorm"

	"nutrition/backend/internal/domain/model"
	domainrepo "nutrition/backend/internal/domain/repository"
)

type ChatRepository struct {
	db *gorm.DB
}

var _ domainrepo.ChatRepository = (*ChatRepository)(nil)

func NewChatRepository(db *gorm.DB) *ChatRepository {
	return &ChatRepository{db: db}
}

func (r *ChatRepository) ListRecent(ctx context.Context, userID uint, limit int) ([]model.ChatMessage, error) {
	var msgs []model.ChatMessage
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("id DESC").Limit(limit).Find(&msgs).Error; err != nil {
		return nil, err
	}
	slices.Reverse(msgs)
	return msgs, nil
}

func (r *ChatRepository) Create(ctx context.Context, msgs []model.ChatMessage) error {
	return r.db.WithContext(ctx).Create(&msgs).Error
}

func (r *ChatRepository) DeleteAll(ctx context.Context, userID uint) error {
	return r.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&model.ChatMessage{}).Error
}

package repository

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"nutrition/backend/internal/domain/model"
	domainrepo "nutrition/backend/internal/domain/repository"
)

type ProfileRepository struct {
	db *gorm.DB
}

var _ domainrepo.ProfileRepository = (*ProfileRepository)(nil)

func NewProfileRepository(db *gorm.DB) *ProfileRepository {
	return &ProfileRepository{db: db}
}

func (r *ProfileRepository) FindByUserID(ctx context.Context, userID uint) (*model.Profile, error) {
	var p model.Profile
	err := r.db.WithContext(ctx).Where("user_id = ?", userID).First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, domainrepo.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *ProfileRepository) Save(ctx context.Context, p *model.Profile) error {
	return r.db.WithContext(ctx).Save(p).Error
}

func (r *ProfileRepository) UpdateMonthlyBudget(ctx context.Context, userID uint, yen int) error {
	res := r.db.WithContext(ctx).Model(&model.Profile{}).
		Where("user_id = ?", userID).Update("monthly_budget", yen)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return domainrepo.ErrNotFound
	}
	return nil
}

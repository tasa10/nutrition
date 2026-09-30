package database

import (
	"context"

	"gorm.io/gorm"
)

// Pinger checks that the database is reachable, for the health endpoint.
type Pinger struct {
	db *gorm.DB
}

func NewPinger(db *gorm.DB) *Pinger {
	return &Pinger{db: db}
}

func (p *Pinger) Ping(ctx context.Context) error {
	sqlDB, err := p.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}

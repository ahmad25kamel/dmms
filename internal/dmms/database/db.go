package database

import (
	"fmt"
	"log"

	"finance-game/internal/dmms/config"
	"finance-game/internal/dmms/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.GetMySQLDSN()
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, fmt.Errorf("open gorm db: %w", err)
	}

	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	log.Println("DMMS MySQL database ready (GORM)")
	return db, nil
}

func runMigrations(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.User{},
		&models.Project{},
		&models.Deliverable{},
		&models.Task{},
		&models.TaskComment{},
		&models.Proposal{},
		&models.Submission{},
		&models.RewardLedgerEntry{},
	)
}

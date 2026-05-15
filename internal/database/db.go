package database

import (
	"fmt"
	"log"

	"dmms/internal/config"
	"dmms/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg *config.Config) (*gorm.DB, error) {
	dsn := cfg.GetMySQLDSN()
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Info),
		DisableForeignKeyConstraintWhenMigrating: true,
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
	// Add username column without unique constraint first, so we can backfill
	if db.Migrator().HasColumn(&models.User{}, "username") == false {
		if err := db.Exec("ALTER TABLE dmms_users ADD COLUMN username VARCHAR(30) NOT NULL DEFAULT ''").Error; err != nil {
			// Column may already exist without constraint — continue
			log.Println("username column add:", err)
		}
	}

	// Backfill empty usernames from id prefix to satisfy uniqueness
	if err := db.Exec(`UPDATE dmms_users SET username = CONCAT('user_', SUBSTRING(id,1,8)) WHERE username = ''`).Error; err != nil {
		log.Println("username backfill:", err)
	}

	return db.AutoMigrate(
		&models.User{},
		&models.Project{},
		&models.Deliverable{},
		&models.Task{},
		&models.TaskComment{},
		&models.Proposal{},
		&models.Submission{},
		&models.RewardLedgerEntry{},
		&models.TaskMember{},
		&models.CommentMention{},
		&models.Notification{},
	)
}

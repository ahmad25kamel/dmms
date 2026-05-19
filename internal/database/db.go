package database

import (
	"fmt"
	"log"

	"dmms/internal/config"
	"dmms/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(cfg *config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector
	if cfg.DBDriver == "mysql" {
		dialector = mysql.Open(cfg.GetMySQLDSN())
	} else {
		dialector = sqlite.Open(cfg.DBPath)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Info),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	if err != nil {
		return nil, fmt.Errorf("open gorm db: %w", err)
	}

	if err := runMigrations(db, cfg.DBDriver); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}
	log.Printf("DMMS %s database ready (GORM)", cfg.DBDriver)
	return db, nil
}

func runMigrations(db *gorm.DB, driver string) error {
	if !db.Migrator().HasColumn(&models.User{}, "username") {
		if err := db.Exec("ALTER TABLE dmms_users ADD COLUMN username VARCHAR(30) NOT NULL DEFAULT ''").Error; err != nil {
			log.Println("username column add:", err)
		}
	}

	// Backfill empty usernames — syntax differs between drivers
	var backfill string
	if driver == "mysql" {
		backfill = `UPDATE dmms_users SET username = CONCAT('user_', SUBSTRING(id,1,8)) WHERE username = ''`
	} else {
		backfill = `UPDATE dmms_users SET username = 'user_' || SUBSTR(id,1,8) WHERE username = ''`
	}
	if err := db.Exec(backfill).Error; err != nil {
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
		&models.AuditLog{},
	)
}

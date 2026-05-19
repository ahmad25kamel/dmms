package repository

import (
	"log"
	"time"

	"dmms/internal/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuditRepo struct {
	db *gorm.DB
}

func NewAuditRepo(db *gorm.DB) *AuditRepo {
	return &AuditRepo{db: db}
}

type AuditFilter struct {
	EntityType string
	Action     string
	UserID     string
	Since      *time.Time
}

func (r *AuditRepo) Log(userID, action, entityType, entityID, entityName, meta string) {
	entry := &models.AuditLog{
		ID:         uuid.New().String(),
		UserID:     userID,
		Action:     action,
		EntityType: entityType,
		EntityID:   entityID,
		EntityName: entityName,
		Meta:       meta,
	}
	if err := r.db.Create(entry).Error; err != nil {
		log.Printf("audit log failed: %v", err)
	}
}

func (r *AuditRepo) List(limit, offset int, f AuditFilter) ([]*models.AuditLog, int64, error) {
	q := r.db.Table("dmms_audit_logs a").
		Select("a.*, u.name as user_name, u.role as user_role").
		Joins("LEFT JOIN dmms_users u ON u.id = a.user_id")

	if f.EntityType != "" {
		q = q.Where("a.entity_type = ?", f.EntityType)
	}
	if f.Action != "" {
		q = q.Where("a.action = ?", f.Action)
	}
	if f.UserID != "" {
		q = q.Where("a.user_id = ?", f.UserID)
	}
	if f.Since != nil {
		q = q.Where("a.created_at >= ?", f.Since)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var logs []*models.AuditLog
	err := q.Order("a.created_at DESC").Limit(limit).Offset(offset).Scan(&logs).Error
	return logs, total, err
}

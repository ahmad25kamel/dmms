package repository

import (
	"dmms/internal/models"
	"gorm.io/gorm"
)

type NotificationRepo struct {
	db *gorm.DB
}

func NewNotificationRepo(db *gorm.DB) *NotificationRepo {
	return &NotificationRepo{db: db}
}

func (r *NotificationRepo) Create(n *models.Notification) error {
	return r.db.Create(n).Error
}

func (r *NotificationRepo) ListForUser(userID string) ([]*models.Notification, error) {
	var out []*models.Notification
	err := r.db.Where("user_id = ?", userID).Order("created_at desc").Limit(50).Find(&out).Error
	return out, err
}

func (r *NotificationRepo) MarkRead(id, userID string) error {
	return r.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("read", true).Error
}

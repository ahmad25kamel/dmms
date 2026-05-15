package repository

import (
	"dmms/internal/models"
	"gorm.io/gorm"
)

type RewardRepo struct {
	db *gorm.DB
}

func NewRewardRepo(db *gorm.DB) *RewardRepo {
	return &RewardRepo{db: db}
}

func (r *RewardRepo) WithDB(db *gorm.DB) *RewardRepo {
	return &RewardRepo{db: db}
}

func (r *RewardRepo) Create(e *models.RewardLedgerEntry) error {
	return r.db.Create(e).Error
}

func (r *RewardRepo) ListByUser(userID string) ([]*models.RewardLedgerEntry, error) {
	var entries []*models.RewardLedgerEntry
	err := r.db.Table("dmms_reward_ledger l").
		Select("l.*, u.name as user_name, d.title as deliverable_title, p.name as project_name").
		Joins("JOIN dmms_users u ON u.id=l.user_id").
		Joins("JOIN dmms_deliverables d ON d.id=l.deliverable_id").
		Joins("JOIN dmms_projects p ON p.id=l.project_id").
		Where("l.user_id = ?", userID).
		Order("l.created_at DESC").
		Scan(&entries).Error
	return entries, err
}

func (r *RewardRepo) ListAll() ([]*models.RewardLedgerEntry, error) {
	var entries []*models.RewardLedgerEntry
	err := r.db.Table("dmms_reward_ledger l").
		Select("l.*, u.name as user_name, d.title as deliverable_title, p.name as project_name").
		Joins("JOIN dmms_users u ON u.id=l.user_id").
		Joins("JOIN dmms_deliverables d ON d.id=l.deliverable_id").
		Joins("JOIN dmms_projects p ON p.id=l.project_id").
		Order("l.created_at DESC").
		Scan(&entries).Error
	return entries, err
}

func (r *RewardRepo) SumByUser(userID string) (float64, error) {
	var total float64
	err := r.db.Model(&models.RewardLedgerEntry{}).
		Where("user_id = ?", userID).
		Select("COALESCE(SUM(amount), 0)").
		Row().Scan(&total)
	return total, err
}

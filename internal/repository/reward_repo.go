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

type ContributorBudgetRow struct {
	UserID    string  `json:"user_id"`
	UserName  string  `json:"user_name"`
	Projected float64 `json:"projected"`
	Approved  float64 `json:"approved"`
	Disbursed float64 `json:"disbursed"`
}

// BudgetBreakdownByPM returns per-contributor budget breakdown for all of a PM's projects.
// projected = pending proposals; approved = accepted+active deliverables; disbursed = reward ledger.
func (r *RewardRepo) BudgetBreakdownByPM(pmID string) ([]*ContributorBudgetRow, error) {
	type row struct {
		UserID string
		Name   string
		Amount float64
	}

	// 1. Pending proposals (projected)
	var projected []row
	if err := r.db.Raw(`
		SELECT p.contributor_id AS user_id, u.name, COALESCE(SUM(p.bid_amount), 0) AS amount
		FROM dmms_proposals p
		JOIN dmms_deliverables d ON d.id = p.deliverable_id AND d.deleted_at IS NULL
		JOIN dmms_projects pr ON pr.id = d.project_id AND pr.deleted_at IS NULL
		JOIN dmms_users u ON u.id = p.contributor_id
		WHERE pr.pm_id = ? AND p.status = 'pending'
		GROUP BY p.contributor_id, u.name
	`, pmID).Scan(&projected).Error; err != nil {
		return nil, err
	}

	// 2. Accepted budget on active deliverables (approved/committed)
	var approved []row
	if err := r.db.Raw(`
		SELECT d.owner_id AS user_id, u.name, COALESCE(SUM(d.accepted_budget), 0) AS amount
		FROM dmms_deliverables d
		JOIN dmms_projects pr ON pr.id = d.project_id AND pr.deleted_at IS NULL
		JOIN dmms_users u ON u.id = d.owner_id
		WHERE pr.pm_id = ? AND d.owner_id IS NOT NULL AND d.accepted_budget IS NOT NULL
		  AND d.status IN ('assigned','in_progress','submitted','revision_requested')
		  AND d.deleted_at IS NULL
		GROUP BY d.owner_id, u.name
	`, pmID).Scan(&approved).Error; err != nil {
		return nil, err
	}

	// 3. Reward ledger (disbursed/cair)
	var disbursed []row
	if err := r.db.Raw(`
		SELECT l.user_id, u.name, COALESCE(SUM(l.amount), 0) AS amount
		FROM dmms_reward_ledger l
		JOIN dmms_projects pr ON pr.id = l.project_id AND pr.deleted_at IS NULL
		JOIN dmms_users u ON u.id = l.user_id
		WHERE pr.pm_id = ?
		GROUP BY l.user_id, u.name
	`, pmID).Scan(&disbursed).Error; err != nil {
		return nil, err
	}

	// Merge by user_id
	index := make(map[string]*ContributorBudgetRow)
	merge := func(rows []row, field string) {
		for _, rw := range rows {
			if _, ok := index[rw.UserID]; !ok {
				index[rw.UserID] = &ContributorBudgetRow{UserID: rw.UserID, UserName: rw.Name}
			}
			switch field {
			case "projected":
				index[rw.UserID].Projected = rw.Amount
			case "approved":
				index[rw.UserID].Approved = rw.Amount
			case "disbursed":
				index[rw.UserID].Disbursed = rw.Amount
			}
		}
	}
	merge(projected, "projected")
	merge(approved, "approved")
	merge(disbursed, "disbursed")

	result := make([]*ContributorBudgetRow, 0, len(index))
	for _, v := range index {
		result = append(result, v)
	}
	return result, nil
}

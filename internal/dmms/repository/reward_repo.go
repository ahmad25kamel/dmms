package repository

import (
	"database/sql"

	"finance-game/internal/dmms/models"
)

type RewardRepo struct {
	db *sql.DB
}

func NewRewardRepo(db *sql.DB) *RewardRepo {
	return &RewardRepo{db: db}
}

func (r *RewardRepo) Create(e *models.RewardLedgerEntry) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_reward_ledger (id,user_id,deliverable_id,project_id,amount,approved_by) VALUES (?,?,?,?,?,?)`,
		e.ID, e.UserID, e.DeliverableID, e.ProjectID, e.Amount, e.ApprovedBy,
	)
	return err
}

func (r *RewardRepo) ListByUser(userID string) ([]*models.RewardLedgerEntry, error) {
	rows, err := r.db.Query(`
		SELECT l.id,l.user_id,l.deliverable_id,l.project_id,l.amount,l.approved_by,l.created_at,
		       u.name,d.title,p.name
		FROM dmms_reward_ledger l
		JOIN dmms_users u ON u.id=l.user_id
		JOIN dmms_deliverables d ON d.id=l.deliverable_id
		JOIN dmms_projects p ON p.id=l.project_id
		WHERE l.user_id=? ORDER BY l.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func (r *RewardRepo) ListAll() ([]*models.RewardLedgerEntry, error) {
	rows, err := r.db.Query(`
		SELECT l.id,l.user_id,l.deliverable_id,l.project_id,l.amount,l.approved_by,l.created_at,
		       u.name,d.title,p.name
		FROM dmms_reward_ledger l
		JOIN dmms_users u ON u.id=l.user_id
		JOIN dmms_deliverables d ON d.id=l.deliverable_id
		JOIN dmms_projects p ON p.id=l.project_id
		ORDER BY l.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func (r *RewardRepo) SumByUser(userID string) (float64, error) {
	var total sql.NullFloat64
	err := r.db.QueryRow(`SELECT SUM(amount) FROM dmms_reward_ledger WHERE user_id=?`, userID).Scan(&total)
	if !total.Valid {
		return 0, err
	}
	return total.Float64, err
}

func scanEntries(rows *sql.Rows) ([]*models.RewardLedgerEntry, error) {
	var entries []*models.RewardLedgerEntry
	for rows.Next() {
		var e models.RewardLedgerEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.DeliverableID, &e.ProjectID, &e.Amount, &e.ApprovedBy, &e.CreatedAt, &e.UserName, &e.DeliverableTitle, &e.ProjectName); err != nil {
			return nil, err
		}
		entries = append(entries, &e)
	}
	return entries, rows.Err()
}

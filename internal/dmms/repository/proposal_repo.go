package repository

import (
	"database/sql"
	"fmt"
	"time"

	"finance-game/internal/dmms/models"
)

type ProposalRepo struct {
	db *sql.DB
}

func NewProposalRepo(db *sql.DB) *ProposalRepo {
	return &ProposalRepo{db: db}
}

func (r *ProposalRepo) Create(p *models.Proposal) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_proposals (id,deliverable_id,contributor_id,bid_amount,eta_date,message,status) VALUES (?,?,?,?,?,?,?)`,
		p.ID, p.DeliverableID, p.ContributorID, p.BidAmount, p.ETADate, p.Message, p.Status,
	)
	return err
}

func (r *ProposalRepo) FindByID(id string) (*models.Proposal, error) {
	row := r.db.QueryRow(`
		SELECT p.id,p.deliverable_id,p.contributor_id,p.bid_amount,p.eta_date,p.message,p.status,p.created_at,u.name
		FROM dmms_proposals p JOIN dmms_users u ON u.id=p.contributor_id WHERE p.id=?`, id)
	return scanProposal(row)
}

func (r *ProposalRepo) ListByDeliverable(deliverableID string) ([]*models.Proposal, error) {
	rows, err := r.db.Query(`
		SELECT p.id,p.deliverable_id,p.contributor_id,p.bid_amount,p.eta_date,p.message,p.status,p.created_at,u.name
		FROM dmms_proposals p JOIN dmms_users u ON u.id=p.contributor_id
		WHERE p.deliverable_id=? ORDER BY p.created_at`, deliverableID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProposals(rows)
}

func (r *ProposalRepo) ListByContributor(contributorID string) ([]*models.Proposal, error) {
	rows, err := r.db.Query(`
		SELECT p.id,p.deliverable_id,p.contributor_id,p.bid_amount,p.eta_date,p.message,p.status,p.created_at,u.name
		FROM dmms_proposals p JOIN dmms_users u ON u.id=p.contributor_id
		WHERE p.contributor_id=? ORDER BY p.created_at DESC`, contributorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProposals(rows)
}

func (r *ProposalRepo) UpdateStatus(id string, status models.ProposalStatus) error {
	_, err := r.db.Exec(`UPDATE dmms_proposals SET status=? WHERE id=?`, status, id)
	return err
}

func (r *ProposalRepo) UpdateBid(id string, bidAmount float64, message string, etaDate *time.Time) error {
	_, err := r.db.Exec(
		`UPDATE dmms_proposals SET bid_amount=?,message=?,eta_date=? WHERE id=? AND status='pending'`,
		bidAmount, message, etaDate, id,
	)
	return err
}

// RejectOthers rejects all pending proposals for a deliverable except the accepted one.
func (r *ProposalRepo) RejectOthers(deliverableID, acceptedID string) error {
	_, err := r.db.Exec(
		`UPDATE dmms_proposals SET status='rejected' WHERE deliverable_id=? AND id!=? AND status='pending'`,
		deliverableID, acceptedID,
	)
	return err
}

func scanProposal(row *sql.Row) (*models.Proposal, error) {
	var p models.Proposal
	var etaDate sql.NullTime
	var name sql.NullString
	if err := row.Scan(&p.ID, &p.DeliverableID, &p.ContributorID, &p.BidAmount, &etaDate, &p.Message, &p.Status, &p.CreatedAt, &name); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("proposal not found")
		}
		return nil, err
	}
	if etaDate.Valid {
		p.ETADate = &etaDate.Time
	}
	if name.Valid {
		p.ContributorName = name.String
	}
	return &p, nil
}

func scanProposals(rows *sql.Rows) ([]*models.Proposal, error) {
	var proposals []*models.Proposal
	for rows.Next() {
		var p models.Proposal
		var etaDate sql.NullTime
		var name sql.NullString
		if err := rows.Scan(&p.ID, &p.DeliverableID, &p.ContributorID, &p.BidAmount, &etaDate, &p.Message, &p.Status, &p.CreatedAt, &name); err != nil {
			return nil, err
		}
		if etaDate.Valid {
			p.ETADate = &etaDate.Time
		}
		if name.Valid {
			p.ContributorName = name.String
		}
		proposals = append(proposals, &p)
	}
	return proposals, rows.Err()
}

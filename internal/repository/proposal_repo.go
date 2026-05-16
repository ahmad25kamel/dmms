package repository

import (
	"fmt"
	"time"

	"dmms/internal/models"
	"gorm.io/gorm"
)

type ProposalRepo struct {
	db *gorm.DB
}

func NewProposalRepo(db *gorm.DB) *ProposalRepo {
	return &ProposalRepo{db: db}
}

func (r *ProposalRepo) WithDB(db *gorm.DB) *ProposalRepo {
	return &ProposalRepo{db: db}
}

func (r *ProposalRepo) Create(p *models.Proposal) error {
	return r.db.Create(p).Error
}

func (r *ProposalRepo) FindByID(id string) (*models.Proposal, error) {
	var p models.Proposal
	err := r.db.Table("dmms_proposals p").
		Select("p.*, u.name as contributor_name").
		Joins("JOIN dmms_users u ON u.id=p.contributor_id").
		Where("p.id = ?", id).Scan(&p).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("proposal not found")
		}
		return nil, err
	}
	return &p, nil
}

func (r *ProposalRepo) ListByDeliverable(deliverableID string) ([]*models.Proposal, error) {
	var proposals []*models.Proposal
	err := r.db.Table("dmms_proposals p").
		Select("p.*, u.name as contributor_name").
		Joins("JOIN dmms_users u ON u.id=p.contributor_id").
		Where("p.deliverable_id = ?", deliverableID).
		Order("p.created_at").Scan(&proposals).Error
	return proposals, err
}

func (r *ProposalRepo) ListByContributor(contributorID string) ([]*models.Proposal, error) {
	var proposals []*models.Proposal
	err := r.db.Table("dmms_proposals p").
		Select("p.*, u.name as contributor_name").
		Joins("JOIN dmms_users u ON u.id=p.contributor_id").
		Where("p.contributor_id = ?", contributorID).
		Order("p.created_at DESC").Scan(&proposals).Error
	return proposals, err
}

func (r *ProposalRepo) UpdateStatus(id string, status models.ProposalStatus) error {
	return r.db.Model(&models.Proposal{}).Where("id = ?", id).Update("status", status).Error
}

func (r *ProposalRepo) UpdateBid(id string, bidAmount float64, message string, etaDate *time.Time) error {
	return r.db.Model(&models.Proposal{}).Where("id = ? AND status = 'pending'", id).Updates(map[string]interface{}{
		"bid_amount": bidAmount,
		"message":    message,
		"eta_date":   etaDate,
	}).Error
}

type ProposalDeliverableCount struct {
	DeliverableID string
	Count         int
}

func (r *ProposalRepo) CountByProject(projectID string) ([]ProposalDeliverableCount, error) {
	var results []ProposalDeliverableCount
	err := r.db.Table("dmms_proposals p").
		Select("p.deliverable_id, COUNT(*) as count").
		Joins("JOIN dmms_deliverables d ON d.id = p.deliverable_id").
		Where("d.project_id = ? AND d.deleted_at IS NULL", projectID).
		Group("p.deliverable_id").
		Scan(&results).Error
	return results, err
}

func (r *ProposalRepo) ListByPM(pmID string) ([]*models.Proposal, error) {
	var proposals []*models.Proposal
	err := r.db.Table("dmms_proposals p").
		Select("p.*, u.name as contributor_name, d.title as deliverable_title").
		Joins("JOIN dmms_users u ON u.id = p.contributor_id").
		Joins("JOIN dmms_deliverables d ON d.id = p.deliverable_id").
		Joins("JOIN dmms_projects pr ON pr.id = d.project_id").
		Where("pr.owner_id = ? AND d.deleted_at IS NULL AND pr.deleted_at IS NULL", pmID).
		Order("p.created_at DESC").
		Scan(&proposals).Error
	return proposals, err
}

// RejectOthers rejects all pending proposals for a deliverable except the accepted one.
func (r *ProposalRepo) RejectOthers(deliverableID, acceptedID string) error {
	return r.db.Model(&models.Proposal{}).
		Where("deliverable_id = ? AND id != ? AND status = 'pending'", deliverableID, acceptedID).
		Update("status", "rejected").Error
}

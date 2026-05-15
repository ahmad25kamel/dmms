package repository

import (
	"fmt"
	"time"

	"finance-game/internal/models"
	"gorm.io/gorm"
)

type SubmissionRepo struct {
	db *gorm.DB
}

func NewSubmissionRepo(db *gorm.DB) *SubmissionRepo {
	return &SubmissionRepo{db: db}
}

func (r *SubmissionRepo) WithDB(db *gorm.DB) *SubmissionRepo {
	return &SubmissionRepo{db: db}
}

func (r *SubmissionRepo) Create(s *models.Submission) error {
	return r.db.Create(s).Error
}

func (r *SubmissionRepo) FindByID(id string) (*models.Submission, error) {
	var s models.Submission
	if err := r.db.First(&s, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("submission not found")
		}
		return nil, err
	}
	return &s, nil
}

func (r *SubmissionRepo) FindByDeliverable(deliverableID string) (*models.Submission, error) {
	var s models.Submission
	if err := r.db.Where("deliverable_id = ?", deliverableID).Order("submitted_at DESC").First(&s).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("submission not found")
		}
		return nil, err
	}
	return &s, nil
}

func (r *SubmissionRepo) ListByDeliverable(deliverableID string) ([]*models.Submission, error) {
	var submissions []*models.Submission
	if err := r.db.Where("deliverable_id = ?", deliverableID).Order("submitted_at DESC").Find(&submissions).Error; err != nil {
		return nil, err
	}
	return submissions, nil
}

func (r *SubmissionRepo) ListPending(pmID string) ([]*models.Submission, error) {
	var submissions []*models.Submission
	err := r.db.Table("dmms_submissions s").
		Joins("JOIN dmms_deliverables d ON d.id=s.deliverable_id").
		Joins("JOIN dmms_projects p ON p.id=d.project_id").
		Where("p.pm_id=? AND s.status='pending'", pmID).
		Order("s.submitted_at").
		Select("s.*").
		Scan(&submissions).Error
	return submissions, err
}

func (r *SubmissionRepo) Update(s *models.Submission) error {
	return r.db.Model(&models.Submission{}).
		Where("id = ? AND status = 'pending'", s.ID).
		Updates(map[string]interface{}{
			"notes":                s.Notes,
			"checklist_completion": s.ChecklistCompletion,
			"file_uploads":         s.FileUploads,
			"pr_links":             s.PRLinks,
		}).Error
}

func (r *SubmissionRepo) Review(id string, status models.SubmissionStatus, reviewerID, notes string) error {
	return r.db.Model(&models.Submission{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       status,
		"reviewer_id":  reviewerID,
		"review_notes": notes,
		"reviewed_at":  time.Now(),
	}).Error
}

package repository

import (
	"dmms/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SubmissionArtifactRepo struct {
	db *gorm.DB
}

func NewSubmissionArtifactRepo(db *gorm.DB) *SubmissionArtifactRepo {
	return &SubmissionArtifactRepo{db: db}
}

func (r *SubmissionArtifactRepo) Create(a *models.SubmissionArtifact) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	return r.db.Create(a).Error
}

func (r *SubmissionArtifactRepo) ListByDeliverable(deliverableID string) ([]*models.SubmissionArtifact, error) {
	var items []*models.SubmissionArtifact
	err := r.db.Table("dmms_submission_artifacts a").
		Select("a.*, t.title as task_title").
		Joins("LEFT JOIN dmms_tasks t ON t.id = a.task_id").
		Where("a.deliverable_id = ?", deliverableID).
		Order("a.created_at ASC").
		Scan(&items).Error
	return items, err
}

func (r *SubmissionArtifactRepo) Delete(artifactID, contributorID string) (bool, error) {
	result := r.db.
		Where("id = ? AND contributor_id = ?", artifactID, contributorID).
		Delete(&models.SubmissionArtifact{})
	return result.RowsAffected > 0, result.Error
}

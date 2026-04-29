package repository

import (
	"fmt"

	"finance-game/internal/dmms/models"
	"gorm.io/gorm"
)

type ProjectRepo struct {
	db *gorm.DB
}

func NewProjectRepo(db *gorm.DB) *ProjectRepo {
	return &ProjectRepo{db: db}
}

func (r *ProjectRepo) WithDB(db *gorm.DB) *ProjectRepo {
	return &ProjectRepo{db: db}
}

func (r *ProjectRepo) Create(p *models.Project) error {
	return r.db.Create(p).Error
}

func (r *ProjectRepo) FindByID(id string) (*models.Project, error) {
	var p models.Project
	if err := r.db.First(&p, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("project not found")
		}
		return nil, err
	}
	return &p, nil
}

func (r *ProjectRepo) ListByPM(pmID string) ([]*models.Project, error) {
	var projects []*models.Project
	if err := r.db.Where("pm_id = ?", pmID).Order("created_at DESC").Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

func (r *ProjectRepo) ListAll() ([]*models.Project, error) {
	var projects []*models.Project
	if err := r.db.Order("created_at DESC").Find(&projects).Error; err != nil {
		return nil, err
	}
	return projects, nil
}

func (r *ProjectRepo) Update(p *models.Project) error {
	return r.db.Save(p).Error
}

func (r *ProjectRepo) UpdateBudget(id string, total, allocated, saved float64) error {
	return r.db.Model(&models.Project{}).Where("id = ?", id).Updates(map[string]interface{}{
		"budget_total":     total,
		"budget_allocated": allocated,
		"budget_saved":     saved,
	}).Error
}

func (r *ProjectRepo) Delete(id string) error {
	return r.db.Delete(&models.Project{}, "id = ?", id).Error
}

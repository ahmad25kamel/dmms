package repository

import (
	"fmt"

	"finance-game/internal/dmms/models"
	"gorm.io/gorm"
)

type DeliverableRepo struct {
	db *gorm.DB
}

func NewDeliverableRepo(db *gorm.DB) *DeliverableRepo {
	return &DeliverableRepo{db: db}
}

func (r *DeliverableRepo) WithDB(db *gorm.DB) *DeliverableRepo {
	return &DeliverableRepo{db: db}
}

func (r *DeliverableRepo) Create(d *models.Deliverable) error {
	return r.db.Create(d).Error
}

func (r *DeliverableRepo) FindByID(id string) (*models.Deliverable, error) {
	var d models.Deliverable
	if err := r.db.First(&d, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("deliverable not found")
		}
		return nil, err
	}
	return &d, nil
}

func (r *DeliverableRepo) ListByProject(projectID string) ([]*models.Deliverable, error) {
	var deliverables []*models.Deliverable
	if err := r.db.Where("project_id = ?", projectID).Order("created_at").Find(&deliverables).Error; err != nil {
		return nil, err
	}
	return deliverables, nil
}

func (r *DeliverableRepo) ListByOwner(ownerID string) ([]*models.Deliverable, error) {
	var deliverables []*models.Deliverable
	if err := r.db.Where("owner_id = ?", ownerID).Order("due_date").Find(&deliverables).Error; err != nil {
		return nil, err
	}
	return deliverables, nil
}

func (r *DeliverableRepo) ListOpenBids(visibility models.Visibility) ([]*models.Deliverable, error) {
	var out []*models.Deliverable
	query := r.db.Model(&models.Deliverable{}).
		Select("dmms_deliverables.*, Project.name as project_name").
		InnerJoins("Project").
		Where("dmms_deliverables.status = ?", "open_for_bids")

	if visibility == models.VisibilityPublic {
		query = query.Where("dmms_deliverables.visibility = ?", "public")
	}

	if err := query.Order("dmms_deliverables.due_date").Scan(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (r *DeliverableRepo) Update(d *models.Deliverable) error {
	return r.db.Save(d).Error
}

func (r *DeliverableRepo) UpdateStatus(id string, status models.DeliverableStatus) error {
	return r.db.Model(&models.Deliverable{}).Where("id = ?", id).Update("status", status).Error
}

func (r *DeliverableRepo) Assign(id string, ownerID string, acceptedBudget float64) error {
	return r.db.Model(&models.Deliverable{}).Where("id = ?", id).Updates(map[string]interface{}{
		"owner_id":        ownerID,
		"accepted_budget": acceptedBudget,
		"status":          "assigned",
	}).Error
}

func (r *DeliverableRepo) Unassign(id string) error {
	return r.db.Model(&models.Deliverable{}).Where("id = ?", id).Updates(map[string]interface{}{
		"owner_id":        nil,
		"accepted_budget": nil,
		"status":          "draft",
	}).Error
}

func (r *DeliverableRepo) ListChildren(parentID string) ([]*models.Deliverable, error) {
	var deliverables []*models.Deliverable
	if err := r.db.Where("parent_id = ?", parentID).Find(&deliverables).Error; err != nil {
		return nil, err
	}
	return deliverables, nil
}

func (r *DeliverableRepo) Delete(id string) error {
	return r.db.Delete(&models.Deliverable{}, "id = ?", id).Error
}

// GetAllDescendantIDs returns all descendant IDs using a recursive CTE.
func (r *DeliverableRepo) GetAllDescendantIDs(id string) ([]string, error) {
	var ids []string
	err := r.db.Raw(`
		WITH RECURSIVE descendants AS (
			SELECT id FROM dmms_deliverables WHERE parent_id=?
			UNION ALL
			SELECT d.id FROM dmms_deliverables d JOIN descendants anc ON d.parent_id=anc.id
		) SELECT id FROM descendants`, id).Scan(&ids).Error
	return ids, err
}

// HasAssignedDescendant checks if any descendant is assigned.
func (r *DeliverableRepo) HasAssignedDescendant(id string) (bool, error) {
	var count int64
	err := r.db.Raw(`
		WITH RECURSIVE descendants AS (
			SELECT id FROM dmms_deliverables WHERE parent_id=?
			UNION ALL
			SELECT d.id FROM dmms_deliverables d JOIN descendants anc ON d.parent_id=anc.id
		) SELECT COUNT(*) FROM descendants desc_ids
		  JOIN dmms_deliverables d ON d.id=desc_ids.id
		  WHERE d.owner_id IS NOT NULL`, id).Scan(&count).Error
	return count > 0, err
}

func (r *DeliverableRepo) GetAncestorIDs(id string) ([]string, error) {
	var ids []string
	err := r.db.Raw(`
		WITH RECURSIVE ancestors AS (
			SELECT parent_id FROM dmms_deliverables WHERE id=?
			UNION ALL
			SELECT d.parent_id FROM dmms_deliverables d JOIN ancestors a ON d.id=a.parent_id
		) SELECT parent_id FROM ancestors WHERE parent_id IS NOT NULL`, id).Scan(&ids).Error
	return ids, err
}

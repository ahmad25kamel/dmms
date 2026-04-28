package repository

import (
	"finance-game/internal/dmms/models"
	"gorm.io/gorm"
)

type KanbanRepo struct {
	db *gorm.DB
}

func NewKanbanRepo(db *gorm.DB) *KanbanRepo {
	return &KanbanRepo{db: db}
}

func (r *KanbanRepo) WithDB(db *gorm.DB) *KanbanRepo {
	return &KanbanRepo{db: db}
}

func (r *KanbanRepo) Create(k *models.KanbanTask) error {
	return r.db.Create(k).Error
}

func (r *KanbanRepo) Update(k *models.KanbanTask) error {
	return r.db.Save(k).Error
}

func (r *KanbanRepo) Delete(id string) error {
	return r.db.Delete(&models.Task{}, "id = ?", id).Error
}

func (r *KanbanRepo) Get(id string) (*models.KanbanTask, error) {
	var k models.Task
	err := r.db.Table("dmms_tasks k").
		Select("k.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=k.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=k.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=k.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=k.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=k.created_by").
		Where("k.id = ?", id).Scan(&k).Error
	if err != nil {
		return nil, err
	}
	return &k, nil
}

type KanbanFilter struct {
	ProjectID     string
	DeliverableID string
	AssignedTo    string
}

func (r *KanbanRepo) List(f KanbanFilter) ([]*models.KanbanTask, error) {
	var out []*models.Task
	query := r.db.Table("dmms_tasks k").
		Select("k.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=k.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=k.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=k.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=k.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=k.created_by")

	if f.ProjectID != "" {
		query = query.Where("k.project_id = ?", f.ProjectID)
	}
	if f.DeliverableID != "" {
		query = query.Where("k.deliverable_id = ?", f.DeliverableID)
	}
	if f.AssignedTo != "" {
		query = query.Where("k.assigned_to = ?", f.AssignedTo)
	}

	err := query.Order("k.position, k.created_at").Scan(&out).Error
	return out, err
}

func (r *KanbanRepo) ListByAssignee(userID string) ([]*models.KanbanTask, error) {
	var out []*models.Task
	err := r.db.Table("dmms_tasks k").
		Select("k.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=k.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=k.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=k.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=k.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=k.created_by").
		Where("k.assigned_to = ?", userID).
		Order("k.status, k.position").Scan(&out).Error
	return out, err
}

func (r *KanbanRepo) ListForContributor(userID string) ([]*models.KanbanTask, error) {
	var out []*models.Task
	err := r.db.Table("dmms_tasks k").
		Select("k.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=k.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=k.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=k.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=k.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=k.created_by").
		Where("EXISTS (SELECT 1 FROM dmms_deliverables dd WHERE dd.id=k.deliverable_id AND dd.owner_id=?)", userID).
		Order("k.status, k.project_id, k.position").Scan(&out).Error
	return out, err
}

func (r *KanbanRepo) ListComments(taskID string) ([]*models.KanbanComment, error) {
	var out []*models.TaskComment
	err := r.db.Table("dmms_task_comments c").
		Select("c.id, c.task_id, c.author_id, COALESCE(u.name,'') as author_name, c.body, c.created_at").
		Joins("LEFT JOIN dmms_users u ON u.id=c.author_id").
		Where("c.task_id = ?", taskID).
		Order("c.created_at").Scan(&out).Error
	return out, err
}

func (r *KanbanRepo) CreateComment(c *models.KanbanComment) error {
	return r.db.Create(c).Error
}

func (r *KanbanRepo) DeleteComment(id string) error {
	return r.db.Delete(&models.TaskComment{}, "id = ?", id).Error
}

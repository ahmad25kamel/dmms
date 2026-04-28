package repository

import (
	"finance-game/internal/dmms/models"
	"gorm.io/gorm"
)

type TaskRepo struct {
	db *gorm.DB
}

func NewTaskRepo(db *gorm.DB) *TaskRepo {
	return &TaskRepo{db: db}
}

func (r *TaskRepo) WithDB(db *gorm.DB) *TaskRepo {
	return &TaskRepo{db: db}
}

func (r *TaskRepo) Create(t *models.Task) error {
	return r.db.Create(t).Error
}

func (r *TaskRepo) Update(t *models.Task) error {
	return r.db.Save(t).Error
}

func (r *TaskRepo) Delete(id string) error {
	return r.db.Delete(&models.Task{}, "id = ?", id).Error
}

func (r *TaskRepo) Get(id string) (*models.Task, error) {
	var t models.Task
	err := r.db.Table("dmms_tasks t").
		Select("t.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=t.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=t.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=t.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=t.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=t.created_by").
		Where("t.id = ?", id).Scan(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TaskRepo) ListByDeliverable(deliverableID string) ([]*models.Task, error) {
	var out []*models.Task
	err := r.db.Table("dmms_tasks t").
		Select("t.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=t.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=t.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=t.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=t.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=t.created_by").
		Where("t.deliverable_id = ?", deliverableID).
		Order("t.position").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) ListByProject(projectID string) ([]*models.Task, error) {
	var out []*models.Task
	err := r.db.Table("dmms_tasks t").
		Select("t.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=t.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=t.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=t.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=t.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=t.created_by").
		Where("t.project_id = ?", projectID).
		Order("t.status, t.position").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) ListAll() ([]*models.Task, error) {
	var out []*models.Task
	err := r.db.Table("dmms_tasks t").
		Select("t.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=t.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=t.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=t.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=t.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=t.created_by").
		Order("t.status, t.position").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) ListForContributor(userID string) ([]*models.Task, error) {
	var out []*models.Task
	err := r.db.Table("dmms_tasks t").
		Select("t.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=t.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=t.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=t.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=t.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=t.created_by").
		Where("t.assigned_to = ? OR EXISTS (SELECT 1 FROM dmms_deliverables dd WHERE dd.id=t.deliverable_id AND dd.owner_id=?)", userID, userID).
		Order("t.status, t.project_id, t.position").Scan(&out).Error
	return out, err
}

// Comments
func (r *TaskRepo) ListComments(taskID string) ([]*models.TaskComment, error) {
	var out []*models.TaskComment
	err := r.db.Table("dmms_task_comments c").
		Select("c.id, c.task_id, c.author_id, COALESCE(u.name,'') as author_name, c.body, c.created_at").
		Joins("LEFT JOIN dmms_users u ON u.id=c.author_id").
		Where("c.task_id = ?", taskID).
		Order("c.created_at").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) GetComment(id string) (*models.TaskComment, error) {
	var c models.TaskComment
	err := r.db.Table("dmms_task_comments c").
		Select("c.id, c.task_id, c.author_id, COALESCE(u.name,'') as author_name, c.body, c.created_at").
		Joins("LEFT JOIN dmms_users u ON u.id=c.author_id").
		Where("c.id = ?", id).Scan(&c).Error
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *TaskRepo) CreateComment(c *models.TaskComment) (*models.TaskComment, error) {
	if err := r.db.Create(c).Error; err != nil {
		return nil, err
	}
	return r.GetComment(c.ID)
}


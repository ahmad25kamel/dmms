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
	return r.db.Model(&models.Task{}).Where("id = ?", t.ID).Updates(map[string]interface{}{
		"title": t.Title,
		"description": t.Description,
		"status": t.Status,
		"is_required": t.IsRequired,
		"due_date": t.DueDate,
		"position": t.Position,
	}).Error
}

func (r *TaskRepo) UpdatePosition(id string, status models.KanbanStatus, position int) error {
	return r.db.Model(&models.Task{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status": status,
		"position": position,
	}).Error
}

func (r *TaskRepo) Delete(id string) error {
	return r.db.Delete(&models.Task{}, "id = ?", id).Error
}

func (r *TaskRepo) Get(id string) (*models.Task, error) {
	var t models.Task
	err := r.db.Model(&models.Task{}).
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
		InnerJoins("Project").
		InnerJoins("Deliverable").
		Joins("AssignedUser").
		Joins("Creator").
		Where("dmms_tasks.id = ?", id).Scan(&t).Error
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *TaskRepo) ListByDeliverable(deliverableID string) ([]*models.Task, error) {
	var out []*models.Task
	err := r.db.Model(&models.Task{}).
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
		InnerJoins("Project").
		InnerJoins("Deliverable").
		Joins("AssignedUser").
		Joins("Creator").
		Where("dmms_tasks.deliverable_id = ?", deliverableID).
		Order("dmms_tasks.position").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) ListByProject(projectID string) ([]*models.Task, error) {
	var out []*models.Task
	err := r.db.Model(&models.Task{}).
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
		InnerJoins("Project").
		InnerJoins("Deliverable").
		Joins("AssignedUser").
		Joins("Creator").
		Where("dmms_tasks.project_id = ?", projectID).
		Order("dmms_tasks.status, dmms_tasks.position").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) ListAll() ([]*models.Task, error) {
	var out []*models.Task
	err := r.db.Model(&models.Task{}).
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
		InnerJoins("Project").
		InnerJoins("Deliverable").
		Joins("AssignedUser").
		Joins("Creator").
		Order("dmms_tasks.status, dmms_tasks.position").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) ListForContributor(userID string) ([]*models.Task, error) {
	var out []*models.Task
	err := r.db.Model(&models.Task{}).
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
		InnerJoins("Project").
		InnerJoins("Deliverable").
		Joins("AssignedUser").
		Joins("Creator").
		Where("dmms_tasks.assigned_to = ? OR EXISTS (SELECT 1 FROM dmms_deliverables dd WHERE dd.id=dmms_tasks.deliverable_id AND dd.owner_id=? AND dd.deleted_at IS NULL)", userID, userID).
		Order("dmms_tasks.status, dmms_tasks.project_id, dmms_tasks.position").Scan(&out).Error
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


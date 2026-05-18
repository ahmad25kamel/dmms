package repository

import (
	"dmms/internal/models"
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
		"file_uploads": t.FilePaths,
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
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, Deliverable.due_date as deliverable_due_date, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
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
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, Deliverable.due_date as deliverable_due_date, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
		InnerJoins("Project").
		InnerJoins("Deliverable").
		Joins("AssignedUser").
		Joins("Creator").
		Where("dmms_tasks.deliverable_id = ?", deliverableID).
		Order("dmms_tasks.position").Scan(&out).Error
	return out, err
}

// TaskFilter holds optional filter params for task list/count queries.
type TaskFilter struct {
	ProjectID     string
	DeliverableID string
	AssignedTo    string
	Status        string
	HideArchived  bool
}


func (r *TaskRepo) CountByProject(projectID, status string) (int64, error) {
	return r.CountFiltered(TaskFilter{ProjectID: projectID, Status: status})
}

func (r *TaskRepo) CountAll(status string) (int64, error) {
	return r.CountFiltered(TaskFilter{Status: status})
}

func (r *TaskRepo) CountFiltered(f TaskFilter) (int64, error) {
	var n int64
	q := r.db.Model(&models.Task{}).InnerJoins("Project").InnerJoins("Deliverable")
	if f.ProjectID != "" {
		q = q.Where("dmms_tasks.project_id = ?", f.ProjectID)
	}
	if f.DeliverableID != "" {
		q = q.Where("dmms_tasks.deliverable_id = ?", f.DeliverableID)
	}
	if f.AssignedTo != "" {
		q = q.Where("dmms_tasks.assigned_to = ?", f.AssignedTo)
	}
	if f.Status != "" {
		q = q.Where("dmms_tasks.status = ?", f.Status)
	}
	if f.HideArchived {
		q = q.Where("dmms_tasks.archived = false")
	}
	return n, q.Count(&n).Error
}

func (r *TaskRepo) CountForContributor(userID, status string) (int64, error) {
	return r.CountForContributorFiltered(userID, TaskFilter{Status: status})
}

func (r *TaskRepo) CountForContributorFiltered(userID string, f TaskFilter) (int64, error) {
	var n int64
	q := r.db.Model(&models.Task{}).InnerJoins("Project").InnerJoins("Deliverable").
		Where(`(dmms_tasks.assigned_to = ?
			OR EXISTS (SELECT 1 FROM dmms_task_members tm WHERE tm.task_id = dmms_tasks.id AND tm.user_id = ?)
			OR EXISTS (SELECT 1 FROM dmms_deliverables dd WHERE dd.id = dmms_tasks.deliverable_id AND dd.owner_id = ? AND dd.deleted_at IS NULL))`,
			userID, userID, userID)
	if f.ProjectID != "" {
		q = q.Where("dmms_tasks.project_id = ?", f.ProjectID)
	}
	if f.DeliverableID != "" {
		q = q.Where("dmms_tasks.deliverable_id = ?", f.DeliverableID)
	}
	if f.Status != "" {
		q = q.Where("dmms_tasks.status = ?", f.Status)
	}
	if f.HideArchived {
		q = q.Where("dmms_tasks.archived = false")
	}
	return n, q.Count(&n).Error
}

func (r *TaskRepo) ListByProject(projectID string, limit, offset int, status string) ([]*models.Task, error) {
	return r.ListFiltered(TaskFilter{ProjectID: projectID, Status: status}, limit, offset)
}

func (r *TaskRepo) ListFiltered(f TaskFilter, limit, offset int) ([]*models.Task, error) {
	var out []*models.Task
	q := r.db.Model(&models.Task{}).
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, Deliverable.due_date as deliverable_due_date, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
		InnerJoins("Project").
		InnerJoins("Deliverable").
		Joins("AssignedUser").
		Joins("Creator")
	if f.ProjectID != "" {
		q = q.Where("dmms_tasks.project_id = ?", f.ProjectID)
	}
	if f.DeliverableID != "" {
		q = q.Where("dmms_tasks.deliverable_id = ?", f.DeliverableID)
	}
	if f.AssignedTo != "" {
		q = q.Where("dmms_tasks.assigned_to = ?", f.AssignedTo)
	}
	if f.Status != "" {
		q = q.Where("dmms_tasks.status = ?", f.Status)
	}
	if f.HideArchived {
		q = q.Where("dmms_tasks.archived = false")
	}
	if limit > 0 {
		q = q.Limit(limit).Offset(offset)
	}
	err := q.Order("CASE WHEN COALESCE(dmms_tasks.due_date, Deliverable.due_date) IS NULL THEN 1 ELSE 0 END, COALESCE(dmms_tasks.due_date, Deliverable.due_date) ASC, dmms_tasks.position").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) ListAll(limit, offset int, status string) ([]*models.Task, error) {
	return r.ListFiltered(TaskFilter{Status: status}, limit, offset)
}

func (r *TaskRepo) ListForContributor(userID string, limit, offset int, status string) ([]*models.Task, error) {
	return r.ListForContributorFiltered(userID, TaskFilter{Status: status}, limit, offset)
}

func (r *TaskRepo) ListForContributorFiltered(userID string, f TaskFilter, limit, offset int) ([]*models.Task, error) {
	var out []*models.Task
	q := r.db.Model(&models.Task{}).
		Select("dmms_tasks.*, Project.name as project_name, Deliverable.title as deliverable_title, Deliverable.due_date as deliverable_due_date, AssignedUser.name as assigned_to_name, Creator.name as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=dmms_tasks.id) as comment_count").
		InnerJoins("Project").
		InnerJoins("Deliverable").
		Joins("AssignedUser").
		Joins("Creator").
		Where(`(dmms_tasks.assigned_to = ?
			OR EXISTS (SELECT 1 FROM dmms_task_members tm WHERE tm.task_id = dmms_tasks.id AND tm.user_id = ?)
			OR EXISTS (SELECT 1 FROM dmms_deliverables dd WHERE dd.id = dmms_tasks.deliverable_id AND dd.owner_id = ? AND dd.deleted_at IS NULL))`,
			userID, userID, userID)
	if f.ProjectID != "" {
		q = q.Where("dmms_tasks.project_id = ?", f.ProjectID)
	}
	if f.DeliverableID != "" {
		q = q.Where("dmms_tasks.deliverable_id = ?", f.DeliverableID)
	}
	if f.Status != "" {
		q = q.Where("dmms_tasks.status = ?", f.Status)
	}
	if f.HideArchived {
		q = q.Where("dmms_tasks.archived = false")
	}
	if limit > 0 {
		q = q.Limit(limit).Offset(offset)
	}
	err := q.Order("CASE WHEN COALESCE(dmms_tasks.due_date, Deliverable.due_date) IS NULL THEN 1 ELSE 0 END, COALESCE(dmms_tasks.due_date, Deliverable.due_date) ASC, dmms_tasks.position").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) SetArchived(id string, archived bool) error {
	return r.db.Model(&models.Task{}).Where("id = ?", id).Update("archived", archived).Error
}

func (r *TaskRepo) CountRequiredPending(deliverableID string) (int64, error) {
	var n int64
	err := r.db.Model(&models.Task{}).
		Where("deliverable_id = ? AND is_required = true AND archived = false AND status != ?", deliverableID, models.KanbanDone).
		Count(&n).Error
	return n, err
}

// Comments
func (r *TaskRepo) ListComments(taskID string) ([]*models.TaskComment, error) {
	var out []*models.TaskComment
	err := r.db.Table("dmms_task_comments c").
		Select("c.id, c.task_id, c.author_id, COALESCE(u.name,'') as author_name, c.body, c.file_uploads, c.created_at").
		Joins("LEFT JOIN dmms_users u ON u.id=c.author_id").
		Where("c.task_id = ?", taskID).
		Order("c.created_at").Scan(&out).Error
	return out, err
}

func (r *TaskRepo) GetComment(id string) (*models.TaskComment, error) {
	var c models.TaskComment
	err := r.db.Table("dmms_task_comments c").
		Select("c.id, c.task_id, c.author_id, COALESCE(u.name,'') as author_name, c.body, c.file_uploads, c.created_at").
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

func (r *TaskRepo) UpdateComment(c *models.TaskComment) error {
	return r.db.Model(&models.TaskComment{}).Where("id = ?", c.ID).Updates(map[string]interface{}{
		"body": c.Body,
		"file_uploads": c.FilePaths,
	}).Error
}


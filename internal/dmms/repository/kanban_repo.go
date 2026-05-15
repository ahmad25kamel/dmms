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
		Select("k.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, d.due_date as deliverable_due_date, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=k.id) as comment_count").
		Joins("LEFT JOIN dmms_projects p ON p.id=k.project_id").
		Joins("LEFT JOIN dmms_deliverables d ON d.id=k.deliverable_id").
		Joins("LEFT JOIN dmms_users u ON u.id=k.assigned_to").
		Joins("LEFT JOIN dmms_users cu ON cu.id=k.created_by").
		Where("k.id = ?", id).Scan(&k).Error
	if err != nil {
		return nil, err
	}
	members, err := r.GetMembers(id)
	if err == nil {
		k.Members = make([]models.TaskMember, 0, len(members))
		for _, m := range members {
			k.Members = append(k.Members, *m)
		}
	}
	return &k, nil
}

func (r *KanbanRepo) GetMembers(taskID string) ([]*models.TaskMember, error) {
	var out []*models.TaskMember
	err := r.db.Table("dmms_task_members m").
		Select("m.*, COALESCE(u.name,'') as user_name").
		Joins("LEFT JOIN dmms_users u ON u.id=m.user_id").
		Where("m.task_id = ?", taskID).
		Order("m.joined_at").Scan(&out).Error
	return out, err
}

func (r *KanbanRepo) AddMember(m *models.TaskMember) error {
	return r.db.Exec(
		"INSERT IGNORE INTO dmms_task_members (id, task_id, user_id, joined_at) VALUES (?, ?, ?, ?)",
		m.ID, m.TaskID, m.UserID, m.JoinedAt,
	).Error
}

func (r *KanbanRepo) GetMembersForTasks(taskIDs []string) (map[string][]models.TaskMember, error) {
	if len(taskIDs) == 0 {
		return map[string][]models.TaskMember{}, nil
	}
	var out []*models.TaskMember
	err := r.db.Table("dmms_task_members m").
		Select("m.*, COALESCE(u.name,'') as user_name").
		Joins("LEFT JOIN dmms_users u ON u.id=m.user_id").
		Where("m.task_id IN ?", taskIDs).
		Order("m.joined_at").Scan(&out).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string][]models.TaskMember)
	for _, m := range out {
		result[m.TaskID] = append(result[m.TaskID], *m)
	}
	return result, nil
}

func (r *KanbanRepo) RemoveMember(taskID, userID string) error {
	return r.db.Exec(
		"DELETE FROM dmms_task_members WHERE task_id = ? AND user_id = ?",
		taskID, userID,
	).Error
}

type KanbanFilter struct {
	ProjectID     string
	DeliverableID string
	AssignedTo    string
}

func (r *KanbanRepo) List(f KanbanFilter) ([]*models.KanbanTask, error) {
	var out []*models.Task
	query := r.db.Table("dmms_tasks k").
		Select("k.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, d.due_date as deliverable_due_date, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=k.id) as comment_count").
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

	err := query.Order("CASE WHEN COALESCE(k.due_date, d.due_date) IS NULL THEN 1 ELSE 0 END, COALESCE(k.due_date, d.due_date) ASC, k.position").Scan(&out).Error
	return out, err
}

func (r *KanbanRepo) ListByAssignee(userID string) ([]*models.KanbanTask, error) {
	var out []*models.Task
	err := r.db.Table("dmms_tasks k").
		Select("k.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, d.due_date as deliverable_due_date, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=k.id) as comment_count").
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
		Select("k.*, COALESCE(p.name,'') as project_name, COALESCE(d.title,'') as deliverable_title, d.due_date as deliverable_due_date, COALESCE(u.name,'') as assigned_to_name, COALESCE(cu.name,'') as created_by_name, (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=k.id) as comment_count").
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

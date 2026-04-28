package repository

import (
	"database/sql"

	"finance-game/internal/dmms/models"
)

type TaskRepo struct {
	db *sql.DB
}

func NewTaskRepo(db *sql.DB) *TaskRepo {
	return &TaskRepo{db: db}
}

const selectTask = `
	SELECT t.id, t.deliverable_id, t.project_id, t.created_by, t.assigned_to, t.title, t.description,
	       t.status, t.is_required, t.due_date, t.position, t.created_at, t.updated_at,
	       COALESCE(p.name,'') as project_name,
	       COALESCE(d.title,'') as deliverable_title,
	       COALESCE(u.name,'') as assigned_to_name,
	       COALESCE(cu.name,'') as created_by_name,
	       (SELECT COUNT(*) FROM dmms_task_comments c WHERE c.task_id=t.id) as comment_count
	FROM dmms_tasks t
	LEFT JOIN dmms_projects p ON p.id=t.project_id
	LEFT JOIN dmms_deliverables d ON d.id=t.deliverable_id
	LEFT JOIN dmms_users u ON u.id=t.assigned_to
	LEFT JOIN dmms_users cu ON cu.id=t.created_by`

func (r *TaskRepo) Create(t *models.Task) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_tasks (id,deliverable_id,project_id,created_by,assigned_to,title,description,status,is_required,due_date,position)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
		t.ID, t.DeliverableID, t.ProjectID, t.CreatedBy, t.AssignedTo,
		t.Title, t.Description, t.Status, t.IsRequired, t.DueDate, t.Position,
	)
	return err
}

func (r *TaskRepo) Update(t *models.Task) error {
	_, err := r.db.Exec(
		`UPDATE dmms_tasks SET assigned_to=?,title=?,description=?,status=?,is_required=?,due_date=?,position=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
		t.AssignedTo, t.Title, t.Description, t.Status, t.IsRequired, t.DueDate, t.Position, t.ID,
	)
	return err
}

func (r *TaskRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM dmms_tasks WHERE id=?`, id)
	return err
}

func (r *TaskRepo) Get(id string) (*models.Task, error) {
	rows, err := r.db.Query(selectTask+` WHERE t.id=?`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, sql.ErrNoRows
	}
	return scanTask(rows)
}

func (r *TaskRepo) ListByDeliverable(deliverableID string) ([]*models.Task, error) {
	rows, err := r.db.Query(selectTask+` WHERE t.deliverable_id=? ORDER BY t.position`, deliverableID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *TaskRepo) ListByProject(projectID string) ([]*models.Task, error) {
	rows, err := r.db.Query(selectTask+` WHERE t.project_id=? ORDER BY t.status, t.position`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *TaskRepo) ListForContributor(userID string) ([]*models.Task, error) {
	rows, err := r.db.Query(selectTask+`
		WHERE t.assigned_to=? 
		OR EXISTS (SELECT 1 FROM dmms_deliverables dd WHERE dd.id=t.deliverable_id AND dd.owner_id=?)
		ORDER BY t.status, t.project_id, t.position`, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.Task
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func scanTask(rows *sql.Rows) (*models.Task, error) {
	var t models.Task
	var assignedTo, description sql.NullString
	var dueDate sql.NullTime
	err := rows.Scan(
		&t.ID, &t.DeliverableID, &t.ProjectID, &t.CreatedBy, &assignedTo,
		&t.Title, &description, &t.Status, &t.IsRequired, &dueDate, &t.Position,
		&t.CreatedAt, &t.UpdatedAt,
		&t.ProjectName, &t.DeliverableTitle, &t.AssignedToName, &t.CreatedByName, &t.CommentCount,
	)
	if err != nil {
		return nil, err
	}
	if assignedTo.Valid {
		t.AssignedTo = &assignedTo.String
	}
	if description.Valid {
		t.Description = description.String
	}
	if dueDate.Valid {
		t.DueDate = &dueDate.Time
	}
	return &t, nil
}

// Comments
func (r *TaskRepo) ListComments(taskID string) ([]*models.TaskComment, error) {
	rows, err := r.db.Query(
		`SELECT c.id, c.task_id, c.author_id, COALESCE(u.name,'') as author_name, c.body, c.created_at
		 FROM dmms_task_comments c
		 LEFT JOIN dmms_users u ON u.id=c.author_id
		 WHERE c.task_id=? ORDER BY c.created_at`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.TaskComment
	for rows.Next() {
		var c models.TaskComment
		if err := rows.Scan(&c.ID, &c.TaskID, &c.AuthorID, &c.AuthorName, &c.Body, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, &c)
	}
	return out, rows.Err()
}

func (r *TaskRepo) CreateComment(c *models.TaskComment) error {
	_, err := r.db.Exec(`INSERT INTO dmms_task_comments (id,task_id,author_id,body) VALUES (?,?,?,?)`, c.ID, c.TaskID, c.AuthorID, c.Body)
	return err
}


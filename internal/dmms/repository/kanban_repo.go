package repository

import (
	"database/sql"
	"time"

	"finance-game/internal/dmms/models"
)

type KanbanRepo struct {
	db *sql.DB
}

func NewKanbanRepo(db *sql.DB) *KanbanRepo {
	return &KanbanRepo{db: db}
}

const selectKanban = `
	SELECT k.id,k.deliverable_id,k.project_id,k.created_by,k.assigned_to,k.title,k.description,
	       k.status,k.due_date,k.position,k.created_at,k.updated_at,
	       COALESCE(p.name,'') as project_name,
	       COALESCE(d.title,'') as deliverable_title,
	       COALESCE(u.name,'') as assigned_to_name,
	       COALESCE(cu.name,'') as created_by_name,
	       (SELECT COUNT(*) FROM dmms_kanban_comments c WHERE c.task_id=k.id) as comment_count
	FROM dmms_kanban_tasks k
	LEFT JOIN dmms_projects p ON p.id=k.project_id
	LEFT JOIN dmms_deliverables d ON d.id=k.deliverable_id
	LEFT JOIN dmms_users u ON u.id=k.assigned_to
	LEFT JOIN dmms_users cu ON cu.id=k.created_by`

func scanKanbanTask(rows *sql.Rows) (*models.KanbanTask, error) {
	var k models.KanbanTask
	var assignedTo sql.NullString
	var dueDate sql.NullTime
	err := rows.Scan(
		&k.ID, &k.DeliverableID, &k.ProjectID, &k.CreatedBy, &assignedTo,
		&k.Title, &k.Description, &k.Status, &dueDate, &k.Position,
		&k.CreatedAt, &k.UpdatedAt,
		&k.ProjectName, &k.DeliverableTitle, &k.AssignedToName, &k.CreatedByName, &k.CommentCount,
	)
	if err != nil {
		return nil, err
	}
	if assignedTo.Valid {
		k.AssignedTo = &assignedTo.String
	}
	if dueDate.Valid {
		k.DueDate = &dueDate.Time
	}
	return &k, nil
}

func (r *KanbanRepo) Create(k *models.KanbanTask) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_kanban_tasks (id,deliverable_id,project_id,created_by,assigned_to,title,description,status,due_date,position)
		 VALUES (?,?,?,?,?,?,?,?,?,?)`,
		k.ID, k.DeliverableID, k.ProjectID, k.CreatedBy, k.AssignedTo,
		k.Title, k.Description, k.Status, k.DueDate, k.Position,
	)
	return err
}

func (r *KanbanRepo) Update(k *models.KanbanTask) error {
	_, err := r.db.Exec(
		`UPDATE dmms_kanban_tasks SET assigned_to=?,title=?,description=?,status=?,due_date=?,position=?,updated_at=? WHERE id=?`,
		k.AssignedTo, k.Title, k.Description, k.Status, k.DueDate, k.Position, time.Now(), k.ID,
	)
	return err
}

func (r *KanbanRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM dmms_kanban_tasks WHERE id=?`, id)
	return err
}

func (r *KanbanRepo) Get(id string) (*models.KanbanTask, error) {
	rows, err := r.db.Query(selectKanban+` WHERE k.id=?`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, sql.ErrNoRows
	}
	return scanKanbanTask(rows)
}

type KanbanFilter struct {
	ProjectID     string
	DeliverableID string
	AssignedTo    string
}

func (r *KanbanRepo) List(f KanbanFilter) ([]*models.KanbanTask, error) {
	q := selectKanban + ` WHERE 1=1`
	args := []interface{}{}
	if f.ProjectID != "" {
		q += ` AND k.project_id=?`
		args = append(args, f.ProjectID)
	}
	if f.DeliverableID != "" {
		q += ` AND k.deliverable_id=?`
		args = append(args, f.DeliverableID)
	}
	if f.AssignedTo != "" {
		q += ` AND k.assigned_to=?`
		args = append(args, f.AssignedTo)
	}
	q += ` ORDER BY k.position, k.created_at`
	rows, err := r.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.KanbanTask
	for rows.Next() {
		k, err := scanKanbanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// ListByAssignee returns tasks where the user is the contributor on the deliverable
func (r *KanbanRepo) ListByAssignee(userID string) ([]*models.KanbanTask, error) {
	q := selectKanban + ` WHERE k.assigned_to=? ORDER BY k.status, k.position`
	rows, err := r.db.Query(q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.KanbanTask
	for rows.Next() {
		k, err := scanKanbanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// ListForContributorDeliverables returns all kanban tasks for deliverables owned by a contributor
func (r *KanbanRepo) ListForContributor(userID string) ([]*models.KanbanTask, error) {
	q := selectKanban + `
	WHERE EXISTS (
		SELECT 1 FROM dmms_deliverables dd WHERE dd.id=k.deliverable_id AND dd.owner_id=?
	)
	ORDER BY k.status, k.project_id, k.position`
	rows, err := r.db.Query(q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.KanbanTask
	for rows.Next() {
		k, err := scanKanbanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, k)
	}
	return out, rows.Err()
}

// Comments

func (r *KanbanRepo) ListComments(taskID string) ([]*models.KanbanComment, error) {
	rows, err := r.db.Query(
		`SELECT c.id,c.task_id,c.author_id,COALESCE(u.name,'') as author_name,c.body,c.created_at
		 FROM dmms_kanban_comments c
		 LEFT JOIN dmms_users u ON u.id=c.author_id
		 WHERE c.task_id=? ORDER BY c.created_at`,
		taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.KanbanComment
	for rows.Next() {
		var c models.KanbanComment
		if err := rows.Scan(&c.ID, &c.TaskID, &c.AuthorID, &c.AuthorName, &c.Body, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, &c)
	}
	return out, rows.Err()
}

func (r *KanbanRepo) CreateComment(c *models.KanbanComment) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_kanban_comments (id,task_id,author_id,body) VALUES (?,?,?,?)`,
		c.ID, c.TaskID, c.AuthorID, c.Body,
	)
	return err
}

func (r *KanbanRepo) DeleteComment(id string) error {
	_, err := r.db.Exec(`DELETE FROM dmms_kanban_comments WHERE id=?`, id)
	return err
}

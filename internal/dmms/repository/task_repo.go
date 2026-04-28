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

func (r *TaskRepo) Create(t *models.Task) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_tasks (id,deliverable_id,title,is_required,position) VALUES (?,?,?,?,?)`,
		t.ID, t.DeliverableID, t.Title, t.IsRequired, t.Position,
	)
	return err
}

func (r *TaskRepo) ListByDeliverable(deliverableID string) ([]*models.Task, error) {
	rows, err := r.db.Query(`SELECT id,deliverable_id,title,is_required,position FROM dmms_tasks WHERE deliverable_id=? ORDER BY position`, deliverableID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tasks []*models.Task
	for rows.Next() {
		var t models.Task
		if err := rows.Scan(&t.ID, &t.DeliverableID, &t.Title, &t.IsRequired, &t.Position); err != nil {
			return nil, err
		}
		tasks = append(tasks, &t)
	}
	return tasks, rows.Err()
}

func (r *TaskRepo) Update(t *models.Task) error {
	_, err := r.db.Exec(`UPDATE dmms_tasks SET title=?,is_required=?,position=? WHERE id=?`, t.Title, t.IsRequired, t.Position, t.ID)
	return err
}

func (r *TaskRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM dmms_tasks WHERE id=?`, id)
	return err
}

type SubtaskRepo struct {
	db *sql.DB
}

func NewSubtaskRepo(db *sql.DB) *SubtaskRepo {
	return &SubtaskRepo{db: db}
}

func (r *SubtaskRepo) Create(s *models.Subtask) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_subtasks (id,deliverable_id,contributor_id,title,done,position) VALUES (?,?,?,?,?,?)`,
		s.ID, s.DeliverableID, s.ContributorID, s.Title, s.Done, s.Position,
	)
	return err
}

func (r *SubtaskRepo) ListByDeliverable(deliverableID string) ([]*models.Subtask, error) {
	rows, err := r.db.Query(`SELECT id,deliverable_id,contributor_id,title,done,position FROM dmms_subtasks WHERE deliverable_id=? ORDER BY position`, deliverableID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var subtasks []*models.Subtask
	for rows.Next() {
		var s models.Subtask
		if err := rows.Scan(&s.ID, &s.DeliverableID, &s.ContributorID, &s.Title, &s.Done, &s.Position); err != nil {
			return nil, err
		}
		subtasks = append(subtasks, &s)
	}
	return subtasks, rows.Err()
}

func (r *SubtaskRepo) Update(s *models.Subtask) error {
	_, err := r.db.Exec(`UPDATE dmms_subtasks SET title=?,done=?,position=? WHERE id=?`, s.Title, s.Done, s.Position, s.ID)
	return err
}

func (r *SubtaskRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM dmms_subtasks WHERE id=?`, id)
	return err
}

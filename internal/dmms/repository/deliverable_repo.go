package repository

import (
	"database/sql"
	"fmt"
	"time"

	"finance-game/internal/dmms/models"
)

type DeliverableRepo struct {
	db *sql.DB
}

func NewDeliverableRepo(db *sql.DB) *DeliverableRepo {
	return &DeliverableRepo{db: db}
}

func (r *DeliverableRepo) Create(d *models.Deliverable) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_deliverables (id,project_id,parent_id,title,brief,scope,acceptance_criteria,max_budget,due_date,dependency_id,visibility,status)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
		d.ID, d.ProjectID, d.ParentID, d.Title, d.Brief, d.Scope,
		d.AcceptanceCriteria, d.MaxBudget, d.DueDate, d.DependencyID,
		d.Visibility, d.Status,
	)
	return err
}

func (r *DeliverableRepo) FindByID(id string) (*models.Deliverable, error) {
	row := r.db.QueryRow(selectDeliverable+` WHERE d.id=?`, id)
	return scanDeliverable(row)
}

func (r *DeliverableRepo) ListByProject(projectID string) ([]*models.Deliverable, error) {
	rows, err := r.db.Query(selectDeliverable+` WHERE d.project_id=? ORDER BY d.created_at`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDeliverables(rows)
}

func (r *DeliverableRepo) ListByOwner(ownerID string) ([]*models.Deliverable, error) {
	rows, err := r.db.Query(selectDeliverable+` WHERE d.owner_id=? ORDER BY d.due_date`, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDeliverables(rows)
}

func (r *DeliverableRepo) ListOpenBids(visibility models.Visibility) ([]*models.Deliverable, error) {
	query := `SELECT d.id,d.project_id,d.parent_id,d.title,d.brief,d.scope,d.acceptance_criteria,
	       d.max_budget,d.accepted_budget,d.due_date,d.dependency_id,d.visibility,d.status,d.owner_id,d.created_at,d.updated_at,
	       COALESCE(p.name,'') as project_name
	FROM dmms_deliverables d
	LEFT JOIN dmms_projects p ON p.id = d.project_id
	WHERE d.status='open_for_bids'`
	if visibility == models.VisibilityPublic {
		query += ` AND d.visibility='public'`
	}
	query += ` ORDER BY d.due_date`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*models.Deliverable
	for rows.Next() {
		d, err := scanDeliverableWithProject(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

func (r *DeliverableRepo) Update(d *models.Deliverable) error {
	_, err := r.db.Exec(
		`UPDATE dmms_deliverables SET title=?,brief=?,scope=?,acceptance_criteria=?,max_budget=?,due_date=?,dependency_id=?,visibility=?,updated_at=? WHERE id=?`,
		d.Title, d.Brief, d.Scope, d.AcceptanceCriteria, d.MaxBudget, d.DueDate, d.DependencyID, d.Visibility, time.Now(), d.ID,
	)
	return err
}

func (r *DeliverableRepo) UpdateStatus(id string, status models.DeliverableStatus) error {
	_, err := r.db.Exec(`UPDATE dmms_deliverables SET status=?,updated_at=? WHERE id=?`, status, time.Now(), id)
	return err
}

func (r *DeliverableRepo) Assign(id string, ownerID string, acceptedBudget float64) error {
	_, err := r.db.Exec(
		`UPDATE dmms_deliverables SET owner_id=?,accepted_budget=?,status='assigned',updated_at=? WHERE id=?`,
		ownerID, acceptedBudget, time.Now(), id,
	)
	return err
}

func (r *DeliverableRepo) Unassign(id string) error {
	_, err := r.db.Exec(
		`UPDATE dmms_deliverables SET owner_id=NULL,accepted_budget=NULL,status='draft',updated_at=? WHERE id=?`,
		time.Now(), id,
	)
	return err
}

func (r *DeliverableRepo) ListChildren(parentID string) ([]*models.Deliverable, error) {
	rows, err := r.db.Query(selectDeliverable+` WHERE d.parent_id=?`, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanDeliverables(rows)
}

func (r *DeliverableRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM dmms_deliverables WHERE id=?`, id)
	return err
}

// GetAllDescendantIDs returns all descendant IDs using a recursive CTE.
func (r *DeliverableRepo) GetAllDescendantIDs(id string) ([]string, error) {
	rows, err := r.db.Query(`
		WITH RECURSIVE descendants AS (
			SELECT id FROM dmms_deliverables WHERE parent_id=?
			UNION ALL
			SELECT d.id FROM dmms_deliverables d JOIN descendants anc ON d.parent_id=anc.id
		) SELECT id FROM descendants`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// HasAssignedDescendant checks if any descendant is assigned.
func (r *DeliverableRepo) HasAssignedDescendant(id string) (bool, error) {
	var count int
	err := r.db.QueryRow(`
		WITH RECURSIVE descendants AS (
			SELECT id FROM dmms_deliverables WHERE parent_id=?
			UNION ALL
			SELECT d.id FROM dmms_deliverables d JOIN descendants anc ON d.parent_id=anc.id
		) SELECT COUNT(*) FROM descendants desc_ids
		  JOIN dmms_deliverables d ON d.id=desc_ids.id
		  WHERE d.owner_id IS NOT NULL`, id).Scan(&count)
	return count > 0, err
}

func (r *DeliverableRepo) GetAncestorIDs(id string) ([]string, error) {
	rows, err := r.db.Query(`
		WITH RECURSIVE ancestors AS (
			SELECT parent_id FROM dmms_deliverables WHERE id=?
			UNION ALL
			SELECT d.parent_id FROM dmms_deliverables d JOIN ancestors a ON d.id=a.parent_id
		) SELECT parent_id FROM ancestors WHERE parent_id IS NOT NULL`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var aid string
		if err := rows.Scan(&aid); err != nil {
			return nil, err
		}
		ids = append(ids, aid)
	}
	return ids, rows.Err()
}

const selectDeliverable = `
	SELECT d.id,d.project_id,d.parent_id,d.title,d.brief,d.scope,d.acceptance_criteria,
	       d.max_budget,d.accepted_budget,d.due_date,d.dependency_id,d.visibility,d.status,d.owner_id,d.created_at,d.updated_at
	FROM dmms_deliverables d`

func scanDeliverable(row *sql.Row) (*models.Deliverable, error) {
	var d models.Deliverable
	var parentID, dependencyID, ownerID sql.NullString
	var acceptedBudget sql.NullFloat64
	var dueDate sql.NullTime
	if err := row.Scan(
		&d.ID, &d.ProjectID, &parentID, &d.Title, &d.Brief, &d.Scope,
		&d.AcceptanceCriteria, &d.MaxBudget, &acceptedBudget, &dueDate,
		&dependencyID, &d.Visibility, &d.Status, &ownerID, &d.CreatedAt, &d.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("deliverable not found")
		}
		return nil, err
	}
	if parentID.Valid {
		d.ParentID = &parentID.String
	}
	if dependencyID.Valid {
		d.DependencyID = &dependencyID.String
	}
	if ownerID.Valid {
		d.OwnerID = &ownerID.String
	}
	if acceptedBudget.Valid {
		d.AcceptedBudget = &acceptedBudget.Float64
	}
	if dueDate.Valid {
		d.DueDate = &dueDate.Time
	}
	return &d, nil
}

func scanDeliverableWithProject(rows *sql.Rows) (*models.Deliverable, error) {
	var d models.Deliverable
	var parentID, dependencyID, ownerID sql.NullString
	var acceptedBudget sql.NullFloat64
	var dueDate sql.NullTime
	if err := rows.Scan(
		&d.ID, &d.ProjectID, &parentID, &d.Title, &d.Brief, &d.Scope,
		&d.AcceptanceCriteria, &d.MaxBudget, &acceptedBudget, &dueDate,
		&dependencyID, &d.Visibility, &d.Status, &ownerID, &d.CreatedAt, &d.UpdatedAt,
		&d.ProjectName,
	); err != nil {
		return nil, err
	}
	if parentID.Valid { d.ParentID = &parentID.String }
	if dependencyID.Valid { d.DependencyID = &dependencyID.String }
	if ownerID.Valid { d.OwnerID = &ownerID.String }
	if acceptedBudget.Valid { d.AcceptedBudget = &acceptedBudget.Float64 }
	if dueDate.Valid { d.DueDate = &dueDate.Time }
	return &d, nil
}

func scanDeliverables(rows *sql.Rows) ([]*models.Deliverable, error) {
	var deliverables []*models.Deliverable
	for rows.Next() {
		var d models.Deliverable
		var parentID, dependencyID, ownerID sql.NullString
		var acceptedBudget sql.NullFloat64
		var dueDate sql.NullTime
		if err := rows.Scan(
			&d.ID, &d.ProjectID, &parentID, &d.Title, &d.Brief, &d.Scope,
			&d.AcceptanceCriteria, &d.MaxBudget, &acceptedBudget, &dueDate,
			&dependencyID, &d.Visibility, &d.Status, &ownerID, &d.CreatedAt, &d.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if parentID.Valid {
			d.ParentID = &parentID.String
		}
		if dependencyID.Valid {
			d.DependencyID = &dependencyID.String
		}
		if ownerID.Valid {
			d.OwnerID = &ownerID.String
		}
		if acceptedBudget.Valid {
			d.AcceptedBudget = &acceptedBudget.Float64
		}
		if dueDate.Valid {
			d.DueDate = &dueDate.Time
		}
		deliverables = append(deliverables, &d)
	}
	return deliverables, rows.Err()
}

package repository

import (
	"database/sql"
	"fmt"
	"time"

	"finance-game/internal/dmms/models"
)

type ProjectRepo struct {
	db *sql.DB
}

func NewProjectRepo(db *sql.DB) *ProjectRepo {
	return &ProjectRepo{db: db}
}

func (r *ProjectRepo) Create(p *models.Project) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_projects (id, name, description, pm_id, budget_total, status)
		 VALUES (?,?,?,?,?,?)`,
		p.ID, p.Name, p.Description, p.PMID, p.BudgetTotal, p.Status,
	)
	return err
}

func (r *ProjectRepo) FindByID(id string) (*models.Project, error) {
	row := r.db.QueryRow(`SELECT id,name,description,pm_id,budget_total,budget_allocated,budget_saved,start_date,end_date,status,created_at,updated_at FROM dmms_projects WHERE id=?`, id)
	return scanProject(row)
}

func (r *ProjectRepo) ListByPM(pmID string) ([]*models.Project, error) {
	rows, err := r.db.Query(`SELECT id,name,description,pm_id,budget_total,budget_allocated,budget_saved,start_date,end_date,status,created_at,updated_at FROM dmms_projects WHERE pm_id=? ORDER BY created_at DESC`, pmID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjects(rows)
}

func (r *ProjectRepo) ListAll() ([]*models.Project, error) {
	rows, err := r.db.Query(`SELECT id,name,description,pm_id,budget_total,budget_allocated,budget_saved,start_date,end_date,status,created_at,updated_at FROM dmms_projects ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjects(rows)
}

func (r *ProjectRepo) Update(p *models.Project) error {
	_, err := r.db.Exec(
		`UPDATE dmms_projects SET name=?,description=?,budget_total=?,start_date=?,end_date=?,status=?,updated_at=? WHERE id=?`,
		p.Name, p.Description, p.BudgetTotal, p.StartDate, p.EndDate, p.Status, time.Now(), p.ID,
	)
	return err
}

func (r *ProjectRepo) UpdateBudget(id string, allocated, saved float64) error {
	_, err := r.db.Exec(
		`UPDATE dmms_projects SET budget_allocated=?, budget_saved=?, updated_at=? WHERE id=?`,
		allocated, saved, time.Now(), id,
	)
	return err
}

func (r *ProjectRepo) Delete(id string) error {
	_, err := r.db.Exec(`DELETE FROM dmms_projects WHERE id=?`, id)
	return err
}

func scanProject(row *sql.Row) (*models.Project, error) {
	var p models.Project
	var startDate, endDate sql.NullTime
	if err := row.Scan(&p.ID, &p.Name, &p.Description, &p.PMID, &p.BudgetTotal, &p.BudgetAllocated, &p.BudgetSaved, &startDate, &endDate, &p.Status, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("project not found")
		}
		return nil, err
	}
	if startDate.Valid {
		p.StartDate = &startDate.Time
	}
	if endDate.Valid {
		p.EndDate = &endDate.Time
	}
	return &p, nil
}

func scanProjects(rows *sql.Rows) ([]*models.Project, error) {
	var projects []*models.Project
	for rows.Next() {
		var p models.Project
		var startDate, endDate sql.NullTime
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.PMID, &p.BudgetTotal, &p.BudgetAllocated, &p.BudgetSaved, &startDate, &endDate, &p.Status, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		if startDate.Valid {
			p.StartDate = &startDate.Time
		}
		if endDate.Valid {
			p.EndDate = &endDate.Time
		}
		projects = append(projects, &p)
	}
	return projects, rows.Err()
}

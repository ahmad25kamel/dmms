package repository

import (
	"database/sql"
	"fmt"
	"time"

	"finance-game/internal/dmms/models"
)

type SubmissionRepo struct {
	db *sql.DB
}

func NewSubmissionRepo(db *sql.DB) *SubmissionRepo {
	return &SubmissionRepo{db: db}
}

func (r *SubmissionRepo) Create(s *models.Submission) error {
	_, err := r.db.Exec(
		`INSERT INTO dmms_submissions (id,deliverable_id,contributor_id,notes,checklist_completion,file_uploads,pr_links,status) VALUES (?,?,?,?,?,?,?,?)`,
		s.ID, s.DeliverableID, s.ContributorID, s.Notes, s.ChecklistCompletion, s.FileUploads, s.PRLinks, s.Status,
	)
	return err
}

func (r *SubmissionRepo) FindByID(id string) (*models.Submission, error) {
	row := r.db.QueryRow(selectSubmission+` WHERE s.id=?`, id)
	return scanSubmission(row)
}

func (r *SubmissionRepo) FindByDeliverable(deliverableID string) (*models.Submission, error) {
	row := r.db.QueryRow(selectSubmission+` WHERE s.deliverable_id=? ORDER BY s.submitted_at DESC LIMIT 1`, deliverableID)
	return scanSubmission(row)
}
func (r *SubmissionRepo) ListByDeliverable(deliverableID string) ([]*models.Submission, error) {
	rows, err := r.db.Query(selectSubmission+` WHERE s.deliverable_id=? ORDER BY s.submitted_at DESC`, deliverableID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSubmissions(rows)
}

func (r *SubmissionRepo) ListPending(pmID string) ([]*models.Submission, error) {
	rows, err := r.db.Query(`
		SELECT s.id,s.deliverable_id,s.contributor_id,s.notes,s.checklist_completion,s.file_uploads,s.pr_links,s.status,s.reviewer_id,s.review_notes,s.submitted_at,s.reviewed_at
		FROM dmms_submissions s
		JOIN dmms_deliverables d ON d.id=s.deliverable_id
		JOIN dmms_projects p ON p.id=d.project_id
		WHERE p.pm_id=? AND s.status='pending' ORDER BY s.submitted_at`, pmID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSubmissions(rows)
}

func (r *SubmissionRepo) Update(s *models.Submission) error {
	_, err := r.db.Exec(
		`UPDATE dmms_submissions SET notes=?,checklist_completion=?,file_uploads=?,pr_links=?,updated_at=? WHERE id=? AND status='pending'`,
		s.Notes, s.ChecklistCompletion, s.FileUploads, s.PRLinks, time.Now(), s.ID,
	)
	return err
}

func (r *SubmissionRepo) Review(id string, status models.SubmissionStatus, reviewerID, notes string) error {
	now := time.Now()
	_, err := r.db.Exec(
		`UPDATE dmms_submissions SET status=?,reviewer_id=?,review_notes=?,reviewed_at=? WHERE id=?`,
		status, reviewerID, notes, now, id,
	)
	return err
}

const selectSubmission = `SELECT s.id,s.deliverable_id,s.contributor_id,s.notes,s.checklist_completion,s.file_uploads,s.pr_links,s.status,s.reviewer_id,s.review_notes,s.submitted_at,s.reviewed_at FROM dmms_submissions s`

func scanSubmission(row *sql.Row) (*models.Submission, error) {
	var s models.Submission
	var reviewerID, reviewNotes sql.NullString
	var reviewedAt sql.NullTime
	if err := row.Scan(&s.ID, &s.DeliverableID, &s.ContributorID, &s.Notes, &s.ChecklistCompletion, &s.FileUploads, &s.PRLinks, &s.Status, &reviewerID, &reviewNotes, &s.SubmittedAt, &reviewedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("submission not found")
		}
		return nil, err
	}
	if reviewerID.Valid {
		s.ReviewerID = &reviewerID.String
	}
	if reviewNotes.Valid {
		s.ReviewNotes = reviewNotes.String
	}
	if reviewedAt.Valid {
		s.ReviewedAt = &reviewedAt.Time
	}
	return &s, nil
}

func scanSubmissions(rows *sql.Rows) ([]*models.Submission, error) {
	var submissions []*models.Submission
	for rows.Next() {
		var s models.Submission
		var reviewerID, reviewNotes sql.NullString
		var reviewedAt sql.NullTime
		if err := rows.Scan(&s.ID, &s.DeliverableID, &s.ContributorID, &s.Notes, &s.ChecklistCompletion, &s.FileUploads, &s.PRLinks, &s.Status, &reviewerID, &reviewNotes, &s.SubmittedAt, &reviewedAt); err != nil {
			return nil, err
		}
		if reviewerID.Valid {
			s.ReviewerID = &reviewerID.String
		}
		if reviewNotes.Valid {
			s.ReviewNotes = reviewNotes.String
		}
		if reviewedAt.Valid {
			s.ReviewedAt = &reviewedAt.Time
		}
		submissions = append(submissions, &s)
	}
	return submissions, rows.Err()
}

package models

import "time"

type Role string

const (
	RolePM          Role = "pm"
	RoleContributor Role = "contributor"
	RoleAdmin       Role = "admin"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	Role         Role      `json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

type ProjectStatus string

const (
	ProjectDraft     ProjectStatus = "draft"
	ProjectActive    ProjectStatus = "active"
	ProjectCompleted ProjectStatus = "completed"
	ProjectCancelled ProjectStatus = "cancelled"
)

type Project struct {
	ID               string        `json:"id"`
	Name             string        `json:"name"`
	Description      string        `json:"description"`
	PMID             string        `json:"pm_id"`
	BudgetTotal      float64       `json:"budget_total"`
	BudgetAllocated  float64       `json:"budget_allocated"`
	BudgetSaved      float64       `json:"budget_saved"`
	StartDate        *time.Time    `json:"start_date"`
	EndDate          *time.Time    `json:"end_date"`
	Status           ProjectStatus `json:"status"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
}

type DeliverableStatus string

const (
	DelivDraft             DeliverableStatus = "draft"
	DelivOpenForBids       DeliverableStatus = "open_for_bids"
	DelivAssigned          DeliverableStatus = "assigned"
	DelivInProgress        DeliverableStatus = "in_progress"
	DelivSubmitted         DeliverableStatus = "submitted"
	DelivApproved          DeliverableStatus = "approved"
	DelivRevisionRequested DeliverableStatus = "revision_requested"
	DelivCancelled         DeliverableStatus = "cancelled"
	DelivRejected          DeliverableStatus = "rejected"
)

type Visibility string

const (
	VisibilityPublic  Visibility = "public"
	VisibilityPrivate Visibility = "private"
)

type Deliverable struct {
	ID                 string            `json:"id"`
	ProjectID          string            `json:"project_id"`
	ParentID           *string           `json:"parent_id"`
	Title              string            `json:"title"`
	Brief              string            `json:"brief"`
	Scope              string            `json:"scope"`
	AcceptanceCriteria string            `json:"acceptance_criteria"` // JSON array
	MaxBudget          float64           `json:"max_budget"`
	AcceptedBudget     *float64          `json:"accepted_budget"`
	DueDate            *time.Time        `json:"due_date"`
	DependencyID       *string           `json:"dependency_id"`
	Visibility         Visibility        `json:"visibility"`
	Status             DeliverableStatus `json:"status"`
	OwnerID            *string           `json:"owner_id"`
	CreatedAt          time.Time         `json:"created_at"`
	UpdatedAt          time.Time         `json:"updated_at"`
	Children           []*Deliverable    `json:"children,omitempty"`
	ProjectName        string            `json:"project_name,omitempty"`
}

type KanbanStatus string

const (
	KanbanBacklog   KanbanStatus = "backlog"
	KanbanTodo      KanbanStatus = "todo"
	KanbanInProgress KanbanStatus = "in_progress"
	KanbanDone       KanbanStatus = "done"
)

type Task struct {
	ID             string       `json:"id"`
	DeliverableID  string       `json:"deliverable_id"`
	ProjectID      string       `json:"project_id"`
	CreatedBy      string       `json:"created_by"`
	AssignedTo     *string      `json:"assigned_to"`
	Title          string       `json:"title"`
	Description    string       `json:"description"`
	Status         KanbanStatus `json:"status"`
	IsRequired     bool         `json:"is_required"`
	DueDate        *time.Time   `json:"due_date"`
	Position       int          `json:"position"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
	// Enriched fields
	ProjectName        string `json:"project_name,omitempty"`
	DeliverableTitle   string `json:"deliverable_title,omitempty"`
	AssignedToName     string `json:"assigned_to_name,omitempty"`
	CreatedByName      string `json:"created_by_name,omitempty"`
	CommentCount       int    `json:"comment_count,omitempty"`
}

// Alias for migration
type KanbanTask = Task

type TaskComment struct {
	ID         string    `json:"id"`
	TaskID     string    `json:"task_id"`
	AuthorID   string    `json:"author_id"`
	AuthorName string    `json:"author_name,omitempty"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"created_at"`
}

// Alias for migration
type KanbanComment = TaskComment


type SubmissionStatus string

const (
	SubmissionPending           SubmissionStatus = "pending"
	SubmissionApproved          SubmissionStatus = "approved"
	SubmissionRejected          SubmissionStatus = "rejected"
	SubmissionRevisionRequested SubmissionStatus = "revision_requested"
)

type Submission struct {
	ID                  string           `json:"id"`
	DeliverableID       string           `json:"deliverable_id"`
	ContributorID       string           `json:"contributor_id"`
	Notes               string           `json:"notes"`
	ChecklistCompletion string           `json:"checklist_completion"` // JSON object
	FileUploads         string           `json:"file_uploads"`         // JSON array
	PRLinks             string           `json:"pr_links"`             // JSON array
	Status              SubmissionStatus `json:"status"`
	ReviewerID          *string          `json:"reviewer_id"`
	ReviewNotes         string           `json:"review_notes"`
	SubmittedAt         time.Time        `json:"submitted_at"`
	ReviewedAt          *time.Time       `json:"reviewed_at"`
}

type ProposalStatus string

const (
	ProposalPending  ProposalStatus = "pending"
	ProposalAccepted ProposalStatus = "accepted"
	ProposalRejected ProposalStatus = "rejected"
	ProposalWithdrawn ProposalStatus = "withdrawn"
)

type Proposal struct {
	ID              string         `json:"id"`
	DeliverableID   string         `json:"deliverable_id"`
	ContributorID   string         `json:"contributor_id"`
	BidAmount       float64        `json:"bid_amount"`
	ETADate         *time.Time     `json:"eta_date"`
	Message         string         `json:"message"`
	Status          ProposalStatus `json:"status"`
	CreatedAt       time.Time      `json:"created_at"`
	ContributorName string         `json:"contributor_name,omitempty"`
}

type RewardLedgerEntry struct {
	ID             string    `json:"id"`
	UserID         string    `json:"user_id"`
	DeliverableID  string    `json:"deliverable_id"`
	ProjectID      string    `json:"project_id"`
	Amount         float64   `json:"amount"`
	ApprovedBy     string    `json:"approved_by"`
	CreatedAt      time.Time `json:"created_at"`
	UserName       string    `json:"user_name,omitempty"`
	DeliverableTitle string  `json:"deliverable_title,omitempty"`
	ProjectName    string    `json:"project_name,omitempty"`
}

package models

import (
	"time"
	"gorm.io/gorm"
)

type Role string

const (
	RolePM          Role = "pm"
	RoleContributor Role = "contributor"
	RoleAdmin       Role = "admin"
)

type User struct {
	ID           string    `json:"id" gorm:"primaryKey;size:191"`
	Username     string    `json:"username" gorm:"unique;not null;size:30"`
	Email        string    `json:"email" gorm:"size:191"`
	PasswordHash string    `json:"-" gorm:"column:password_hash;not null"`
	Name         string    `json:"name" gorm:"not null"`
	Role         Role      `json:"role" gorm:"not null"`
	CreatedAt    time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

func (User) TableName() string { return "dmms_users" }

type ProjectStatus string

const (
	ProjectDraft     ProjectStatus = "draft"
	ProjectActive    ProjectStatus = "active"
	ProjectCompleted ProjectStatus = "completed"
	ProjectCancelled ProjectStatus = "cancelled"
)

type Project struct {
	ID               string        `json:"id" gorm:"primaryKey;size:191"`
	Name             string        `json:"name" gorm:"not null"`
	Description      string        `json:"description"`
	PMID             string        `json:"pm_id" gorm:"column:pm_id;not null;size:191"`
	BudgetCeiling    float64       `json:"budget_ceiling" gorm:"column:budget_ceiling;not null;default:0"`
	BudgetTotal      float64       `json:"budget_total" gorm:"column:budget_total;not null;default:0"`
	BudgetAllocated  float64       `json:"budget_allocated" gorm:"column:budget_allocated;not null;default:0"`
	BudgetSaved      float64       `json:"budget_saved" gorm:"column:budget_saved;not null;default:0"`
	StartDate        *time.Time    `json:"start_date"`
	EndDate          *time.Time    `json:"end_date"`
	Status           ProjectStatus `json:"status" gorm:"not null;default:'draft'"`
	CreatedAt        time.Time     `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt        time.Time     `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	DeletedAt        gorm.DeletedAt `json:"deleted_at" gorm:"index"`
}

func (Project) TableName() string { return "dmms_projects" }

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
	ID                 string            `json:"id" gorm:"primaryKey;size:191"`
	ProjectID          string            `json:"project_id" gorm:"column:project_id;not null;size:191"`
	ParentID           *string           `json:"parent_id" gorm:"column:parent_id;size:191"`
	Title              string            `json:"title" gorm:"not null"`
	Brief              string            `json:"brief" gorm:"type:text"`
	Scope              string            `json:"scope" gorm:"type:text"`
	AcceptanceCriteria string            `json:"acceptance_criteria" gorm:"column:acceptance_criteria;type:text;default:'[]'"` // JSON array
	MaxBudget          float64           `json:"max_budget" gorm:"column:max_budget;not null;default:0"`
	AcceptedBudget     *float64          `json:"accepted_budget" gorm:"column:accepted_budget"`
	StartDate          *time.Time        `json:"start_date" gorm:"column:start_date"`
	DueDate            *time.Time        `json:"due_date" gorm:"column:due_date"`
	DependencyID       *string           `json:"dependency_id" gorm:"column:dependency_id;size:191"`
	Visibility         Visibility        `json:"visibility" gorm:"not null;default:'public'"`
	Status             DeliverableStatus `json:"status" gorm:"not null;default:'draft'"`
	OwnerID            *string           `json:"owner_id" gorm:"column:owner_id;size:191"`
	CreatedAt          time.Time         `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt          time.Time         `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	Children           []*Deliverable    `json:"children,omitempty" gorm:"foreignKey:ParentID"`
	ProposalCount      int               `json:"proposal_count" gorm:"->"`
	ProjectName        string            `json:"project_name,omitempty" gorm:"->"`
	Project            *Project          `json:"-" gorm:"foreignKey:ProjectID"`
	DeletedAt          gorm.DeletedAt    `json:"deleted_at" gorm:"index"`
}

func (Deliverable) TableName() string { return "dmms_deliverables" }

type KanbanStatus string

const (
	KanbanBacklog   KanbanStatus = "backlog"
	KanbanTodo      KanbanStatus = "todo"
	KanbanInProgress KanbanStatus = "in_progress"
	KanbanDone       KanbanStatus = "done"
)

type Task struct {
	ID             string       `json:"id" gorm:"primaryKey;size:191"`
	DeliverableID  string       `json:"deliverable_id" gorm:"column:deliverable_id;not null;size:191"`
	ProjectID      string       `json:"project_id" gorm:"column:project_id;not null;size:191"`
	CreatedBy      string       `json:"created_by" gorm:"column:created_by;not null;size:191"`
	AssignedTo     *string      `json:"assigned_to" gorm:"column:assigned_to;size:191"`
	Title          string       `json:"title" gorm:"not null"`
	Description    string       `json:"description" gorm:"type:text"`
	Status         KanbanStatus `json:"status" gorm:"not null;default:'backlog'"`
	IsRequired     bool         `json:"is_required" gorm:"column:is_required;not null;default:0"`
	Archived       bool         `json:"archived" gorm:"column:archived;not null;default:0"`
	DueDate        *time.Time   `json:"due_date" gorm:"column:due_date"`
	Position       int          `json:"position" gorm:"not null;default:0"`
	CreatedAt      time.Time    `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt      time.Time    `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
	FilePaths      string       `json:"file_uploads" gorm:"column:file_uploads;default:'[]'"`
	// Enriched fields
	ProjectName        string     `json:"project_name,omitempty" gorm:"->"`
	DeliverableTitle   string     `json:"deliverable_title,omitempty" gorm:"->"`
	DeliverableDueDate *time.Time `json:"deliverable_due_date,omitempty" gorm:"->"`
	AssignedToName     string     `json:"assigned_to_name,omitempty" gorm:"->"`
	CreatedByName      string     `json:"created_by_name,omitempty" gorm:"->"`
	CommentCount       int        `json:"comment_count,omitempty" gorm:"->"`
	Members            []TaskMember `json:"members,omitempty" gorm:"-"`

	// Associations
	Project      *Project     `json:"-" gorm:"foreignKey:ProjectID"`
	Deliverable  *Deliverable `json:"-" gorm:"foreignKey:DeliverableID"`
	AssignedUser *User        `json:"-" gorm:"foreignKey:AssignedTo"`
	Creator      *User        `json:"-" gorm:"foreignKey:CreatedBy"`
}

func (Task) TableName() string { return "dmms_tasks" }

// Alias for migration
type KanbanTask = Task

type TaskComment struct {
	ID         string    `json:"id" gorm:"primaryKey;size:191"`
	TaskID     string    `json:"task_id" gorm:"column:task_id;not null;size:191"`
	AuthorID   string    `json:"author_id" gorm:"column:author_id;not null;size:191"`
	AuthorName string    `json:"author_name,omitempty" gorm:"->"`
	Body       string    `json:"body" gorm:"not null"`
	FilePaths  string    `json:"file_uploads" gorm:"column:file_uploads;default:'[]'"`
	CreatedAt  time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

func (TaskComment) TableName() string { return "dmms_task_comments" }

// Alias for migration
type KanbanComment = TaskComment

type TaskMember struct {
	ID       string    `json:"id" gorm:"primaryKey;size:191"`
	TaskID   string    `json:"task_id" gorm:"column:task_id;not null;size:191;uniqueIndex:uidx_task_user"`
	UserID   string    `json:"user_id" gorm:"column:user_id;not null;size:191;uniqueIndex:uidx_task_user"`
	UserName string    `json:"user_name,omitempty" gorm:"->"`
	JoinedAt time.Time `json:"joined_at" gorm:"default:CURRENT_TIMESTAMP"`
}

func (TaskMember) TableName() string { return "dmms_task_members" }

type CommentMention struct {
	ID        string    `json:"id" gorm:"primaryKey;size:191"`
	CommentID string    `json:"comment_id" gorm:"column:comment_id;not null;size:191;index"`
	UserID    string    `json:"user_id" gorm:"column:user_id;not null;size:191;index"`
	Username  string    `json:"username" gorm:"column:username;not null;size:30"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

func (CommentMention) TableName() string { return "dmms_comment_mentions" }

type Notification struct {
	ID        string    `json:"id" gorm:"primaryKey;size:191"`
	UserID    string    `json:"user_id" gorm:"column:user_id;not null;size:191;index"`
	Kind      string    `json:"kind" gorm:"not null;size:50"`
	Payload   string    `json:"payload" gorm:"not null;default:'{}'"`
	Read      bool      `json:"read" gorm:"not null;default:false"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

func (Notification) TableName() string { return "dmms_notifications" }

type SubmissionStatus string

const (
	SubmissionPending           SubmissionStatus = "pending"
	SubmissionApproved          SubmissionStatus = "approved"
	SubmissionRejected          SubmissionStatus = "rejected"
	SubmissionRevisionRequested SubmissionStatus = "revision_requested"
)

type Submission struct {
	ID                  string           `json:"id" gorm:"primaryKey;size:191"`
	DeliverableID       string           `json:"deliverable_id" gorm:"column:deliverable_id;not null;size:191"`
	ContributorID       string           `json:"contributor_id" gorm:"column:contributor_id;not null;size:191"`
	Notes               string           `json:"notes"`
	ChecklistCompletion string           `json:"checklist_completion" gorm:"column:checklist_completion;default:'{}'"` // JSON object
	FileUploads         string           `json:"file_uploads" gorm:"column:file_uploads;default:'[]'"`         // JSON array
	PRLinks             string           `json:"pr_links" gorm:"column:pr_links;default:'[]'"`             // JSON array
	Status              SubmissionStatus `json:"status" gorm:"not null;default:'pending'"`
	ReviewerID          *string          `json:"reviewer_id" gorm:"column:reviewer_id;size:191"`
	ReviewNotes         string           `json:"review_notes" gorm:"column:review_notes"`
	SubmittedAt         time.Time        `json:"submitted_at" gorm:"column:submitted_at;default:CURRENT_TIMESTAMP"`
	ReviewedAt          *time.Time       `json:"reviewed_at" gorm:"column:reviewed_at"`
}

func (Submission) TableName() string { return "dmms_submissions" }

type ProposalStatus string

const (
	ProposalPending  ProposalStatus = "pending"
	ProposalAccepted ProposalStatus = "accepted"
	ProposalRejected ProposalStatus = "rejected"
	ProposalWithdrawn ProposalStatus = "withdrawn"
)

type Proposal struct {
	ID               string         `json:"id" gorm:"primaryKey;size:191"`
	DeliverableID    string         `json:"deliverable_id" gorm:"column:deliverable_id;not null;size:191"`
	ContributorID    string         `json:"contributor_id" gorm:"column:contributor_id;not null;size:191"`
	BidAmount        float64        `json:"bid_amount" gorm:"column:bid_amount;not null"`
	ETADate          *time.Time     `json:"eta_date" gorm:"column:eta_date"`
	Message          string         `json:"message"`
	Status           ProposalStatus `json:"status" gorm:"not null;default:'pending'"`
	CreatedAt        time.Time      `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	ContributorName  string         `json:"contributor_name,omitempty" gorm:"->"`
	DeliverableTitle string         `json:"deliverable_title,omitempty" gorm:"->"`
	ProjectName      string         `json:"project_name,omitempty" gorm:"->"`
}

func (Proposal) TableName() string { return "dmms_proposals" }

type RewardLedgerEntry struct {
	ID               string    `json:"id" gorm:"primaryKey;size:191"`
	UserID           string    `json:"user_id" gorm:"column:user_id;not null;size:191"`
	DeliverableID    string    `json:"deliverable_id" gorm:"column:deliverable_id;not null;size:191"`
	ProjectID        string    `json:"project_id" gorm:"column:project_id;not null;size:191"`
	Amount           float64   `json:"amount" gorm:"not null"`
	ApprovedBy       string    `json:"approved_by" gorm:"column:approved_by;not null;size:191"`
	CreatedAt        time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UserName         string    `json:"user_name,omitempty" gorm:"->"`
	DeliverableTitle string    `json:"deliverable_title,omitempty" gorm:"->"`
	ProjectName      string    `json:"project_name,omitempty" gorm:"->"`
}

func (RewardLedgerEntry) TableName() string { return "dmms_reward_ledger" }

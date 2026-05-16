package service

import (
	"fmt"

	"dmms/internal/models"
	"dmms/internal/repository"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type DeliverableService struct {
	deliverables *repository.DeliverableRepo
	proposals    *repository.ProposalRepo
	rewards      *repository.RewardRepo
	projects     *repository.ProjectRepo
	db           *gorm.DB
}

func NewDeliverableService(
	deliverables *repository.DeliverableRepo,
	proposals *repository.ProposalRepo,
	rewards *repository.RewardRepo,
	projects *repository.ProjectRepo,
	db *gorm.DB,
) *DeliverableService {
	return &DeliverableService{deliverables: deliverables, proposals: proposals, rewards: rewards, projects: projects, db: db}
}

func (s *DeliverableService) Create(d *models.Deliverable) error {
	d.ID = uuid.New().String()
	if d.AcceptanceCriteria == "" {
		d.AcceptanceCriteria = "[]"
	}
	if d.Status == "" {
		d.Status = models.DelivDraft
	}
	if d.Visibility == "" {
		d.Visibility = models.VisibilityPublic
	}
	if err := s.deliverables.Create(d); err != nil {
		return err
	}
	return s.SyncBudget(d.ProjectID)
}

func (s *DeliverableService) SyncBudget(projectID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		return s.recomputeProjectBudget(tx, projectID)
	})
}

// OpenForBids transitions a deliverable to open_for_bids.
// Blocked if any child is assigned or if a dependency is not yet approved.
func (s *DeliverableService) OpenForBids(id string) error {
	d, err := s.deliverables.FindByID(id)
	if err != nil {
		return err
	}
	if d.Status != models.DelivDraft && d.Status != models.DelivRevisionRequested {
		return fmt.Errorf("cannot open for bids from status %s", d.Status)
	}
	hasAssigned, err := s.deliverables.HasAssignedDescendant(id)
	if err != nil {
		return err
	}
	if hasAssigned {
		return fmt.Errorf("cannot open for bids: a child deliverable is already assigned")
	}
	if d.DependencyID != nil {
		dep, err := s.deliverables.FindByID(*d.DependencyID)
		if err != nil {
			return fmt.Errorf("dependency deliverable not found")
		}
		if dep.Status != models.DelivApproved {
			return fmt.Errorf("dependency deliverable must be approved before opening this one for bids")
		}
	}
	return s.deliverables.UpdateStatus(id, models.DelivOpenForBids)
}

// AcceptProposal assigns a deliverable to a contributor, rejects all other proposals,
// locks all descendants, and blocks parent from bidding.
func (s *DeliverableService) AcceptProposal(proposalID string, pmID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		txDeliv := s.deliverables.WithDB(tx)
		txProp := s.proposals.WithDB(tx)

		proposal, err := txProp.FindByID(proposalID)
		if err != nil {
			return err
		}
		if proposal.Status != models.ProposalPending {
			return fmt.Errorf("proposal is not pending")
		}

		deliverable, err := txDeliv.FindByID(proposal.DeliverableID)
		if err != nil {
			return err
		}
		if deliverable.Status != models.DelivOpenForBids {
			return fmt.Errorf("deliverable is not open for bids")
		}
		if proposal.BidAmount > deliverable.MaxBudget {
			return fmt.Errorf("bid exceeds max budget")
		}

		// Assign deliverable
		if err := txDeliv.Assign(deliverable.ID, proposal.ContributorID, proposal.BidAmount); err != nil {
			return err
		}

		// Accept winning proposal
		if err := txProp.UpdateStatus(proposalID, models.ProposalAccepted); err != nil {
			return err
		}

		// Reject all other proposals
		if err := txProp.RejectOthers(deliverable.ID, proposalID); err != nil {
			return err
		}

		// Lock all descendant deliverables (set owner to same contributor)
		descendantIDs, err := txDeliv.GetAllDescendantIDs(deliverable.ID)
		if err != nil {
			return err
		}
		for _, childID := range descendantIDs {
			if err := txDeliv.UpdateStatus(childID, models.DelivAssigned); err != nil {
				return err
			}
		}

		// Assign all tasks of deliverable and its descendants to the contributor
		allDeliverableIDs := append([]string{deliverable.ID}, descendantIDs...)
		if err := tx.Table("dmms_tasks").
			Where("deliverable_id IN ?", allDeliverableIDs).
			Update("assigned_to", proposal.ContributorID).Error; err != nil {
			return err
		}

		// Update project budget_allocated
		return s.recomputeProjectBudget(tx, deliverable.ProjectID)
	})
}

// ApproveSubmission approves a submission, creates ledger entry, updates budget.
func (s *DeliverableService) ApproveSubmission(submissionID, reviewerID string, submissionRepo *repository.SubmissionRepo) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		txDeliv := s.deliverables.WithDB(tx)
		txReward := s.rewards.WithDB(tx)
		txSub := submissionRepo.WithDB(tx)

		sub, err := txSub.FindByID(submissionID)
		if err != nil {
			return err
		}
		if sub.Status != models.SubmissionPending {
			return fmt.Errorf("submission is not pending")
		}

		deliverable, err := txDeliv.FindByID(sub.DeliverableID)
		if err != nil {
			return err
		}

		// Mark deliverable approved
		if err := txDeliv.UpdateStatus(deliverable.ID, models.DelivApproved); err != nil {
			return err
		}

		// Review submission
		if err := txSub.Review(submissionID, models.SubmissionApproved, reviewerID, ""); err != nil {
			return err
		}

		// Create reward ledger entry
		amount := deliverable.MaxBudget
		if deliverable.AcceptedBudget != nil {
			amount = *deliverable.AcceptedBudget
		}
		entry := &models.RewardLedgerEntry{
			ID:            uuid.New().String(),
			UserID:        sub.ContributorID,
			DeliverableID: deliverable.ID,
			ProjectID:     deliverable.ProjectID,
			Amount:        amount,
			ApprovedBy:    reviewerID,
		}
		if err := txReward.Create(entry); err != nil {
			return err
		}

		// Recompute project budget
		return s.recomputeProjectBudget(tx, deliverable.ProjectID)
	})
}

func (s *DeliverableService) Reassign(deliverableID string) error {
	d, err := s.deliverables.FindByID(deliverableID)
	if err != nil {
		return err
	}
	if d.Status != models.DelivAssigned && d.Status != models.DelivInProgress && d.Status != models.DelivRevisionRequested && d.Status != models.DelivRejected {
		return fmt.Errorf("cannot reassign from status %s", d.Status)
	}
	// Unassign and reopen for bids
	if err := s.deliverables.Unassign(deliverableID); err != nil {
		return err
	}
	return s.deliverables.UpdateStatus(deliverableID, models.DelivOpenForBids)
}

func (s *DeliverableService) Cancel(deliverableID string) error {
	return s.deliverables.UpdateStatus(deliverableID, models.DelivCancelled)
}

func (s *DeliverableService) Reopen(deliverableID string) error {
	return s.deliverables.UpdateStatus(deliverableID, models.DelivDraft)
}

// recomputeProjectBudget recalculates budget_allocated and budget_saved from deliverables.
func (s *DeliverableService) recomputeProjectBudget(tx *gorm.DB, projectID string) error {
	var all []*models.Deliverable
	if err := tx.Where("project_id = ?", projectID).Find(&all).Error; err != nil {
		return err
	}

	idx := make(map[string]*models.Deliverable, len(all))
	for _, d := range all {
		idx[d.ID] = d
		d.Children = nil
	}
	var roots []*models.Deliverable
	for _, d := range all {
		if d.ParentID == nil {
			roots = append(roots, d)
		} else if parent, ok := idx[*d.ParentID]; ok {
			parent.Children = append(parent.Children, d)
		}
	}

	var calc func(*models.Deliverable) float64
	var changed []*models.Deliverable
	calc = func(d *models.Deliverable) float64 {
		old := d.MaxBudget
		if len(d.Children) > 0 {
			var sum float64
			for _, c := range d.Children {
				sum += calc(c)
			}
			d.MaxBudget = sum
		}
		if d.MaxBudget != old {
			changed = append(changed, d)
		}
		return d.MaxBudget
	}

	var total float64
	for _, r := range roots {
		total += calc(r)
	}

	for _, d := range changed {
		if err := tx.Model(d).Update("max_budget", d.MaxBudget).Error; err != nil {
			return err
		}
	}

	var res struct {
		Allocated float64
		Saved     float64
	}

	err := tx.Table("dmms_deliverables").
		Select(`
			SUM(COALESCE(accepted_budget, 0)) as allocated,
			SUM(CASE WHEN status='approved' THEN max_budget - COALESCE(accepted_budget, 0) ELSE 0 END) as saved
		`).
		Where("project_id = ? AND status IN ('assigned', 'in_progress', 'submitted', 'approved')", projectID).
		Scan(&res).Error
	if err != nil {
		return err
	}

	return tx.Table("dmms_projects").
		Where("id = ?", projectID).
		UpdateColumns(map[string]interface{}{
			"budget_total":     total,
			"budget_allocated": res.Allocated,
			"budget_saved":     res.Saved,
			"updated_at":       gorm.Expr("CURRENT_TIMESTAMP"),
		}).Error
}

func (s *DeliverableService) BuildTree(projectID string) ([]*models.Deliverable, error) {
	all, err := s.deliverables.ListByProject(projectID)
	if err != nil {
		return nil, err
	}

	counts, err := s.proposals.CountByProject(projectID)
	if err == nil {
		countMap := make(map[string]int, len(counts))
		for _, c := range counts {
			countMap[c.DeliverableID] = c.Count
		}
		for _, d := range all {
			d.ProposalCount = countMap[d.ID]
		}
	}

	return buildTree(all), nil
}

func buildTree(flat []*models.Deliverable) []*models.Deliverable {
	idx := make(map[string]*models.Deliverable, len(flat))
	for _, d := range flat {
		idx[d.ID] = d
		d.Children = nil
	}
	var roots []*models.Deliverable
	for _, d := range flat {
		if d.ParentID == nil {
			roots = append(roots, d)
		} else if parent, ok := idx[*d.ParentID]; ok {
			parent.Children = append(parent.Children, d)
		}
	}

	var calc func(*models.Deliverable) float64
	calc = func(d *models.Deliverable) float64 {
		if len(d.Children) > 0 {
			var sum float64
			for _, c := range d.Children {
				sum += calc(c)
			}
			d.MaxBudget = sum
		}
		return d.MaxBudget
	}
	for _, r := range roots {
		calc(r)
	}

	return roots
}

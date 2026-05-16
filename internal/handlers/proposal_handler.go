package handlers

import (
	"net/http"

	"dmms/internal/middleware"
	"dmms/internal/models"
	"dmms/internal/repository"
	"dmms/internal/service"

	"github.com/google/uuid"
)

type ProposalHandler struct {
	proposals    *repository.ProposalRepo
	deliverables *repository.DeliverableRepo
	projects     *repository.ProjectRepo
	delivSvc     *service.DeliverableService
}

func NewProposalHandler(proposals *repository.ProposalRepo, deliverables *repository.DeliverableRepo, projects *repository.ProjectRepo, delivSvc *service.DeliverableService) *ProposalHandler {
	return &ProposalHandler{proposals: proposals, deliverables: deliverables, projects: projects, delivSvc: delivSvc}
}

func (h *ProposalHandler) List(w http.ResponseWriter, r *http.Request) {
	deliverableID := r.PathValue("id")
	proposals, err := h.proposals.ListByDeliverable(deliverableID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list proposals")
		return
	}
	if proposals == nil {
		proposals = []*models.Proposal{}
	}
	JSON(w, http.StatusOK, proposals)
}

func (h *ProposalHandler) AllForPM(w http.ResponseWriter, r *http.Request) {
	pmID := middleware.GetUserID(r)
	proposals, err := h.proposals.ListByPM(pmID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list proposals")
		return
	}
	if proposals == nil {
		proposals = []*models.Proposal{}
	}
	JSON(w, http.StatusOK, proposals)
}

func (h *ProposalHandler) Mine(w http.ResponseWriter, r *http.Request) {
	contributorID := middleware.GetUserID(r)
	proposals, err := h.proposals.ListByContributor(contributorID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list proposals")
		return
	}
	if proposals == nil {
		proposals = []*models.Proposal{}
	}
	JSON(w, http.StatusOK, proposals)
}

func (h *ProposalHandler) Submit(w http.ResponseWriter, r *http.Request) {
	deliverableID := r.PathValue("id")
	contributorID := middleware.GetUserID(r)

	d, err := h.deliverables.FindByID(deliverableID)
	if err != nil {
		Err(w, http.StatusNotFound, "deliverable not found")
		return
	}
	if d.Status != models.DelivOpenForBids {
		Err(w, http.StatusBadRequest, "deliverable is not open for bids")
		return
	}
	proj, err := h.projects.FindByID(d.ProjectID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to load project")
		return
	}
	if proj.PMID == contributorID {
		Err(w, http.StatusForbidden, "PM cannot submit a proposal on their own project's deliverable")
		return
	}

	var body struct {
		BidAmount float64  `json:"bid_amount"`
		ETADate   *string  `json:"eta_date"`
		Message   string   `json:"message"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.BidAmount <= 0 {
		Err(w, http.StatusBadRequest, "bid_amount must be positive")
		return
	}
	if body.BidAmount > d.MaxBudget {
		Err(w, http.StatusBadRequest, "bid exceeds max budget")
		return
	}

	p := &models.Proposal{
		ID:            uuid.New().String(),
		DeliverableID: deliverableID,
		ContributorID: contributorID,
		BidAmount:     body.BidAmount,
		Message:       body.Message,
		Status:        models.ProposalPending,
	}
	if err := h.proposals.Create(p); err != nil {
		Err(w, http.StatusConflict, "already submitted a proposal for this deliverable")
		return
	}
	JSON(w, http.StatusCreated, p)
}

func (h *ProposalHandler) Revise(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	proposal, err := h.proposals.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "proposal not found")
		return
	}
	if proposal.ContributorID != middleware.GetUserID(r) {
		Err(w, http.StatusForbidden, "not your proposal")
		return
	}
	if proposal.Status != models.ProposalPending {
		Err(w, http.StatusBadRequest, "can only revise pending proposals")
		return
	}
	var body struct {
		BidAmount float64 `json:"bid_amount"`
		Message   string  `json:"message"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.proposals.UpdateBid(id, body.BidAmount, body.Message, nil); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update proposal")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (h *ProposalHandler) Withdraw(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	proposal, err := h.proposals.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "proposal not found")
		return
	}
	if proposal.ContributorID != middleware.GetUserID(r) {
		Err(w, http.StatusForbidden, "not your proposal")
		return
	}
	if err := h.proposals.UpdateStatus(id, models.ProposalWithdrawn); err != nil {
		Err(w, http.StatusInternalServerError, "failed to withdraw")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"withdrawn": true})
}

func (h *ProposalHandler) Accept(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	pmID := middleware.GetUserID(r)
	if err := h.delivSvc.AcceptProposal(id, pmID); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"accepted": true})
}

func (h *ProposalHandler) Reject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	callerID := middleware.GetUserID(r)

	proposal, err := h.proposals.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "proposal not found")
		return
	}
	d, err := h.deliverables.FindByID(proposal.DeliverableID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to load deliverable")
		return
	}
	proj, err := h.projects.FindByID(d.ProjectID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to load project")
		return
	}
	if proj.PMID != callerID {
		Err(w, http.StatusForbidden, "you are not the PM of this project")
		return
	}
	if err := h.proposals.UpdateStatus(id, models.ProposalRejected); err != nil {
		Err(w, http.StatusInternalServerError, "failed to reject")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"rejected": true})
}

package handlers

import (
	"net/http"

	"finance-game/internal/dmms/middleware"
	"finance-game/internal/dmms/models"
	"finance-game/internal/dmms/repository"
	"finance-game/internal/dmms/service"

	"github.com/google/uuid"
)

type SubmissionHandler struct {
	submissions  *repository.SubmissionRepo
	deliverables *repository.DeliverableRepo
	subtasks     *repository.SubtaskRepo
	delivSvc     *service.DeliverableService
}

func NewSubmissionHandler(
	submissions *repository.SubmissionRepo,
	deliverables *repository.DeliverableRepo,
	subtasks *repository.SubtaskRepo,
	delivSvc *service.DeliverableService,
) *SubmissionHandler {
	return &SubmissionHandler{submissions: submissions, deliverables: deliverables, subtasks: subtasks, delivSvc: delivSvc}
}

func (h *SubmissionHandler) Submit(w http.ResponseWriter, r *http.Request) {
	deliverableID := r.PathValue("id")
	contributorID := middleware.GetUserID(r)

	d, err := h.deliverables.FindByID(deliverableID)
	if err != nil {
		Err(w, http.StatusNotFound, "deliverable not found")
		return
	}
	if d.OwnerID == nil || *d.OwnerID != contributorID {
		Err(w, http.StatusForbidden, "you are not the owner of this deliverable")
		return
	}

	var body struct {
		Notes               string `json:"notes"`
		ChecklistCompletion string `json:"checklist_completion"`
		FileUploads         string `json:"file_uploads"`
		PRLinks             string `json:"pr_links"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}

	s := &models.Submission{
		ID:                  uuid.New().String(),
		DeliverableID:       deliverableID,
		ContributorID:       contributorID,
		Notes:               body.Notes,
		ChecklistCompletion: body.ChecklistCompletion,
		FileUploads:         body.FileUploads,
		PRLinks:             body.PRLinks,
		Status:              models.SubmissionPending,
	}
	if s.ChecklistCompletion == "" {
		s.ChecklistCompletion = "{}"
	}
	if s.FileUploads == "" {
		s.FileUploads = "[]"
	}
	if s.PRLinks == "" {
		s.PRLinks = "[]"
	}

	if err := h.submissions.Create(s); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create submission")
		return
	}

	// Move deliverable to submitted
	h.deliverables.UpdateStatus(deliverableID, models.DelivSubmitted) //nolint:errcheck

	JSON(w, http.StatusCreated, s)
}

func (h *SubmissionHandler) GetByDeliverable(w http.ResponseWriter, r *http.Request) {
	deliverableID := r.PathValue("id")
	s, err := h.submissions.FindByDeliverable(deliverableID)
	if err != nil {
		Err(w, http.StatusNotFound, "no submission found")
		return
	}
	JSON(w, http.StatusOK, s)
}

func (h *SubmissionHandler) PendingForPM(w http.ResponseWriter, r *http.Request) {
	pmID := middleware.GetUserID(r)
	submissions, err := h.submissions.ListPending(pmID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list submissions")
		return
	}
	if submissions == nil {
		submissions = []*models.Submission{}
	}
	JSON(w, http.StatusOK, submissions)
}

func (h *SubmissionHandler) Approve(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	reviewerID := middleware.GetUserID(r)
	if err := h.delivSvc.ApproveSubmission(id, reviewerID, h.submissions); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"approved": true})
}

func (h *SubmissionHandler) RequestRevision(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	reviewerID := middleware.GetUserID(r)
	var body struct {
		Notes string `json:"notes"`
	}
	Decode(r, &body) //nolint:errcheck
	if err := h.submissions.Review(id, models.SubmissionRevisionRequested, reviewerID, body.Notes); err != nil {
		Err(w, http.StatusInternalServerError, "failed to request revision")
		return
	}
	// Move deliverable to revision_requested
	sub, _ := h.submissions.FindByID(id)
	if sub != nil {
		h.deliverables.UpdateStatus(sub.DeliverableID, models.DelivRevisionRequested) //nolint:errcheck
	}
	JSON(w, http.StatusOK, map[string]bool{"revision_requested": true})
}

func (h *SubmissionHandler) RejectSubmission(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	reviewerID := middleware.GetUserID(r)
	var body struct {
		Notes string `json:"notes"`
	}
	Decode(r, &body) //nolint:errcheck
	if err := h.submissions.Review(id, models.SubmissionRejected, reviewerID, body.Notes); err != nil {
		Err(w, http.StatusInternalServerError, "failed to reject submission")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"rejected": true})
}

// Subtasks sub-resource
func (h *SubmissionHandler) ListSubtasks(w http.ResponseWriter, r *http.Request) {
	deliverableID := r.PathValue("id")
	subtasks, err := h.subtasks.ListByDeliverable(deliverableID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list subtasks")
		return
	}
	if subtasks == nil {
		subtasks = []*models.Subtask{}
	}
	JSON(w, http.StatusOK, subtasks)
}

func (h *SubmissionHandler) CreateSubtask(w http.ResponseWriter, r *http.Request) {
	deliverableID := r.PathValue("id")
	contributorID := middleware.GetUserID(r)
	var body struct {
		Title    string `json:"title"`
		Position int    `json:"position"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	s := &models.Subtask{
		ID:            uuid.New().String(),
		DeliverableID: deliverableID,
		ContributorID: contributorID,
		Title:         body.Title,
		Position:      body.Position,
	}
	if err := h.subtasks.Create(s); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create subtask")
		return
	}
	JSON(w, http.StatusCreated, s)
}

func (h *SubmissionHandler) UpdateSubtask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("subtaskId")
	var body struct {
		Title    string `json:"title"`
		Done     bool   `json:"done"`
		Position int    `json:"position"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	s := &models.Subtask{ID: id, Title: body.Title, Done: body.Done, Position: body.Position}
	if err := h.subtasks.Update(s); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update subtask")
		return
	}
	JSON(w, http.StatusOK, s)
}

package handlers

import (
	"net/http"
	"time"

	"finance-game/internal/dmms/middleware"
	"finance-game/internal/dmms/models"
	"finance-game/internal/dmms/repository"
	"github.com/google/uuid"
)

type KanbanHandler struct {
	repo *repository.KanbanRepo
}

func NewKanbanHandler(repo *repository.KanbanRepo) *KanbanHandler {
	return &KanbanHandler{repo: repo}
}

// GET /kanban?project_id=&deliverable_id=&assigned_to= (PM view)
func (h *KanbanHandler) List(w http.ResponseWriter, r *http.Request) {
	f := repository.KanbanFilter{
		ProjectID:     r.URL.Query().Get("project_id"),
		DeliverableID: r.URL.Query().Get("deliverable_id"),
		AssignedTo:    r.URL.Query().Get("assigned_to"),
	}
	tasks, err := h.repo.List(f)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list kanban tasks")
		return
	}
	if tasks == nil {
		tasks = []*models.KanbanTask{}
	}
	JSON(w, http.StatusOK, tasks)
}

// GET /kanban/mine (contributor view — all tasks for their deliverables)
func (h *KanbanHandler) Mine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	tasks, err := h.repo.ListForContributor(userID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list kanban tasks")
		return
	}
	if tasks == nil {
		tasks = []*models.KanbanTask{}
	}
	JSON(w, http.StatusOK, tasks)
}

// POST /kanban
func (h *KanbanHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var body struct {
		DeliverableID string  `json:"deliverable_id"`
		ProjectID     string  `json:"project_id"`
		Title         string  `json:"title"`
		Description   string  `json:"description"`
		AssignedTo    *string `json:"assigned_to"`
		DueDate       *string `json:"due_date"`
		Status        string  `json:"status"`
	}
	if err := Decode(r, &body); err != nil || body.Title == "" || body.DeliverableID == "" || body.ProjectID == "" {
		Err(w, http.StatusBadRequest, "title, deliverable_id, and project_id are required")
		return
	}
	status := models.KanbanBacklog
	if body.Status != "" {
		status = models.KanbanStatus(body.Status)
	}
	k := &models.KanbanTask{
		ID:            uuid.New().String(),
		DeliverableID: body.DeliverableID,
		ProjectID:     body.ProjectID,
		CreatedBy:     userID,
		AssignedTo:    body.AssignedTo,
		Title:         body.Title,
		Description:   body.Description,
		Status:        status,
	}
	if body.DueDate != nil && *body.DueDate != "" {
		t, err := time.Parse("2006-01-02", *body.DueDate)
		if err == nil {
			k.DueDate = &t
		}
	}
	if err := h.repo.Create(k); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create task")
		return
	}
	// Re-fetch to get enriched fields
	enriched, err := h.repo.Get(k.ID)
	if err != nil {
		JSON(w, http.StatusCreated, k)
		return
	}
	JSON(w, http.StatusCreated, enriched)
}

// PATCH /kanban/:id
func (h *KanbanHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.repo.Get(id)
	if err != nil {
		Err(w, http.StatusNotFound, "task not found")
		return
	}
	var body struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
		AssignedTo  *string `json:"assigned_to"`
		DueDate     *string `json:"due_date"`
		Position    *int    `json:"position"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.Title != nil {
		existing.Title = *body.Title
	}
	if body.Description != nil {
		existing.Description = *body.Description
	}
	if body.Status != nil {
		existing.Status = models.KanbanStatus(*body.Status)
	}
	if body.AssignedTo != nil {
		existing.AssignedTo = body.AssignedTo
	}
	if body.Position != nil {
		existing.Position = *body.Position
	}
	if body.DueDate != nil {
		if *body.DueDate == "" {
			existing.DueDate = nil
		} else {
			t, err := time.Parse("2006-01-02", *body.DueDate)
			if err == nil {
				existing.DueDate = &t
			}
		}
	}
	if err := h.repo.Update(existing); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update task")
		return
	}
	enriched, err := h.repo.Get(id)
	if err != nil {
		JSON(w, http.StatusOK, existing)
		return
	}
	JSON(w, http.StatusOK, enriched)
}

// DELETE /kanban/:id
func (h *KanbanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.repo.Delete(id); err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

// GET /kanban/:id/comments
func (h *KanbanHandler) ListComments(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	comments, err := h.repo.ListComments(taskID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list comments")
		return
	}
	if comments == nil {
		comments = []*models.KanbanComment{}
	}
	JSON(w, http.StatusOK, comments)
}

// POST /kanban/:id/comments
func (h *KanbanHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	authorID := middleware.GetUserID(r)
	var body struct {
		Body string `json:"body"`
	}
	if err := Decode(r, &body); err != nil || body.Body == "" {
		Err(w, http.StatusBadRequest, "body is required")
		return
	}
	c := &models.KanbanComment{
		ID:       uuid.New().String(),
		TaskID:   taskID,
		AuthorID: authorID,
		Body:     body.Body,
	}
	if err := h.repo.CreateComment(c); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create comment")
		return
	}
	// Re-fetch with author name
	comments, _ := h.repo.ListComments(taskID)
	for _, cm := range comments {
		if cm.ID == c.ID {
			JSON(w, http.StatusCreated, cm)
			return
		}
	}
	JSON(w, http.StatusCreated, c)
}

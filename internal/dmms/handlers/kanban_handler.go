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
	tasks *repository.TaskRepo
}

func NewKanbanHandler(tasks *repository.TaskRepo) *KanbanHandler {
	return &KanbanHandler{tasks: tasks}
}

// GET /kanban?project_id=
func (h *KanbanHandler) List(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("project_id")
	var tasks []*models.Task
	var err error

	if projectID != "" {
		tasks, err = h.tasks.ListByProject(projectID)
	} else {
		tasks, err = h.tasks.ListAll()
	}

	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	if tasks == nil {
		tasks = []*models.Task{}
	}
	JSON(w, http.StatusOK, tasks)
}

// GET /kanban/mine (contributor view — all tasks for their deliverables)
func (h *KanbanHandler) Mine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	tasks, err := h.tasks.ListForContributor(userID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	if tasks == nil {
		tasks = []*models.Task{}
	}
	JSON(w, http.StatusOK, tasks)
}

// POST /kanban
func (h *KanbanHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	var body struct {
		DeliverableID string            `json:"deliverable_id"`
		ProjectID     string            `json:"project_id"`
		Title         string            `json:"title"`
		Description   string            `json:"description"`
		AssignedTo    *string           `json:"assigned_to"`
		DueDate       *string           `json:"due_date"`
		Status        models.KanbanStatus `json:"status"`
	}
	if err := Decode(r, &body); err != nil || body.Title == "" || body.DeliverableID == "" || body.ProjectID == "" {
		Err(w, http.StatusBadRequest, "title, deliverable_id, and project_id are required")
		return
	}
	status := models.KanbanBacklog
	if body.Status != "" {
		status = body.Status
	}
	t := &models.Task{
		ID:            uuid.New().String(),
		DeliverableID: body.DeliverableID,
		ProjectID:     body.ProjectID,
		CreatedBy:     userID,
		AssignedTo:    body.AssignedTo,
		Title:         body.Title,
		Description:   body.Description,
		Status:        status,
		IsRequired:    false,
	}
	if body.DueDate != nil && *body.DueDate != "" {
		dt, err := time.Parse("2006-01-02", *body.DueDate)
		if err == nil {
			t.DueDate = &dt
		}
	}
	if err := h.tasks.Create(t); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create task")
		return
	}
	JSON(w, http.StatusCreated, t)
}

// PATCH /kanban/:id
func (h *KanbanHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	existing, err := h.tasks.Get(id)
	if err != nil {
		Err(w, http.StatusNotFound, "task not found")
		return
	}
	var body struct {
		Title       *string           `json:"title"`
		Description *string           `json:"description"`
		Status      *models.KanbanStatus `json:"status"`
		AssignedTo  *string           `json:"assigned_to"`
		DueDate     *string           `json:"due_date"`
		Position    *int              `json:"position"`
		IsRequired  *bool             `json:"is_required"`
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
		existing.Status = *body.Status
	}
	if body.AssignedTo != nil {
		existing.AssignedTo = body.AssignedTo
	}
	if body.Position != nil {
		existing.Position = *body.Position
	}
	if body.IsRequired != nil {
		existing.IsRequired = *body.IsRequired
	}
	if body.DueDate != nil {
		if *body.DueDate == "" {
			existing.DueDate = nil
		} else {
			dt, err := time.Parse("2006-01-02", *body.DueDate)
			if err == nil {
				existing.DueDate = &dt
			}
		}
	}
	if err := h.tasks.Update(existing); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update task")
		return
	}
	JSON(w, http.StatusOK, existing)
}

// DELETE /kanban/:id
func (h *KanbanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.tasks.Delete(id); err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

// GET /kanban/:id/comments
func (h *KanbanHandler) ListComments(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	comments, err := h.tasks.ListComments(taskID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list comments")
		return
	}
	if comments == nil {
		comments = []*models.TaskComment{}
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
	c := &models.TaskComment{
		ID:       uuid.New().String(),
		TaskID:   taskID,
		AuthorID: authorID,
		Body:     body.Body,
	}
	newComment, err := h.tasks.CreateComment(c)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to create comment")
		return
	}
	JSON(w, http.StatusCreated, newComment)
}

// PUT /kanban/reorder
func (h *KanbanHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	var body []struct {
		ID       string              `json:"id"`
		Status   models.KanbanStatus `json:"status"`
		Position int                 `json:"position"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid body")
		return
	}

	for _, item := range body {
		h.tasks.UpdatePosition(item.ID, item.Status, item.Position)
	}

	JSON(w, http.StatusOK, map[string]bool{"success": true})
}

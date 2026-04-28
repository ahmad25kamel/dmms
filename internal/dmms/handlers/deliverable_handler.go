package handlers

import (
	"net/http"

	"finance-game/internal/dmms/middleware"
	"finance-game/internal/dmms/models"
	"finance-game/internal/dmms/repository"
	"finance-game/internal/dmms/service"
	"github.com/google/uuid"
)

type DeliverableHandler struct {
	repo    *repository.DeliverableRepo
	tasks   *repository.TaskRepo
	svc     *service.DeliverableService
	projects *repository.ProjectRepo
}

func NewDeliverableHandler(
	repo *repository.DeliverableRepo,
	tasks *repository.TaskRepo,
	svc *service.DeliverableService,
	projects *repository.ProjectRepo,
) *DeliverableHandler {
	return &DeliverableHandler{repo: repo, tasks: tasks, svc: svc, projects: projects}
}

func (h *DeliverableHandler) Tree(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("projectId")
	tree, err := h.svc.BuildTree(projectID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to build tree")
		return
	}
	if tree == nil {
		tree = []*models.Deliverable{}
	}
	JSON(w, http.StatusOK, tree)
}

func (h *DeliverableHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ProjectID          string             `json:"project_id"`
		ParentID           *string            `json:"parent_id"`
		Title              string             `json:"title"`
		Brief              string             `json:"brief"`
		Scope              string             `json:"scope"`
		AcceptanceCriteria string             `json:"acceptance_criteria"`
		MaxBudget          float64            `json:"max_budget"`
		DueDate            *string            `json:"due_date"`
		DependencyID       *string            `json:"dependency_id"`
		Visibility         models.Visibility  `json:"visibility"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Title == "" || body.ProjectID == "" {
		Err(w, http.StatusBadRequest, "project_id and title are required")
		return
	}
	d := &models.Deliverable{
		ProjectID:          body.ProjectID,
		ParentID:           body.ParentID,
		Title:              body.Title,
		Brief:              body.Brief,
		Scope:              body.Scope,
		AcceptanceCriteria: body.AcceptanceCriteria,
		MaxBudget:          body.MaxBudget,
		DependencyID:       body.DependencyID,
		Visibility:         body.Visibility,
	}
	if err := h.svc.Create(d); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create deliverable")
		return
	}
	JSON(w, http.StatusCreated, d)
}

func (h *DeliverableHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	d, err := h.repo.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "deliverable not found")
		return
	}
	JSON(w, http.StatusOK, d)
}

func (h *DeliverableHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	d, err := h.repo.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "deliverable not found")
		return
	}
	var body struct {
		Title              string            `json:"title"`
		Brief              string            `json:"brief"`
		Scope              string            `json:"scope"`
		AcceptanceCriteria string            `json:"acceptance_criteria"`
		MaxBudget          float64           `json:"max_budget"`
		Visibility         models.Visibility `json:"visibility"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Title != "" {
		d.Title = body.Title
	}
	d.Brief = body.Brief
	d.Scope = body.Scope
	if body.AcceptanceCriteria != "" {
		d.AcceptanceCriteria = body.AcceptanceCriteria
	}
	if body.MaxBudget > 0 {
		d.MaxBudget = body.MaxBudget
	}
	if body.Visibility != "" {
		d.Visibility = body.Visibility
	}
	if err := h.repo.Update(d); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update deliverable")
		return
	}
	JSON(w, http.StatusOK, d)
}

func (h *DeliverableHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.repo.Delete(id); err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete deliverable")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *DeliverableHandler) OpenForBids(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.OpenForBids(id); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	d, _ := h.repo.FindByID(id)
	JSON(w, http.StatusOK, d)
}

func (h *DeliverableHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Cancel(id); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"cancelled": true})
}

func (h *DeliverableHandler) Reopen(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Reopen(id); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"reopened": true})
}

func (h *DeliverableHandler) Reassign(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.svc.Reassign(id); err != nil {
		Err(w, http.StatusBadRequest, err.Error())
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"reassigned": true})
}

func (h *DeliverableHandler) MyAssigned(w http.ResponseWriter, r *http.Request) {
	ownerID := middleware.GetUserID(r)
	deliverables, err := h.repo.ListByOwner(ownerID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list deliverables")
		return
	}
	if deliverables == nil {
		deliverables = []*models.Deliverable{}
	}
	JSON(w, http.StatusOK, deliverables)
}

// Tasks sub-resource
func (h *DeliverableHandler) ListTasks(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	tasks, err := h.tasks.ListByDeliverable(id)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	if tasks == nil {
		tasks = []*models.Task{}
	}
	JSON(w, http.StatusOK, tasks)
}

func (h *DeliverableHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := middleware.GetUserID(r)

	d, err := h.repo.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "deliverable not found")
		return
	}

	var body struct {
		Title      string `json:"title"`
		IsRequired bool   `json:"is_required"`
		Position   int    `json:"position"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}

	t := &models.Task{
		ID:            uuid.New().String(),
		DeliverableID: id,
		ProjectID:     d.ProjectID,
		CreatedBy:     userID,
		Title:         body.Title,
		IsRequired:    body.IsRequired,
		Position:      body.Position,
		Status:        models.KanbanTodo,
	}

	if err := h.tasks.Create(t); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create task")
		return
	}
	JSON(w, http.StatusCreated, t)
}

func (h *DeliverableHandler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("taskId")
	t, err := h.tasks.Get(id)
	if err != nil {
		Err(w, http.StatusNotFound, "task not found")
		return
	}

	var body struct {
		Title      string `json:"title"`
		IsRequired bool   `json:"is_required"`
		Position   int    `json:"position"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}

	t.Title = body.Title
	t.IsRequired = body.IsRequired
	t.Position = body.Position

	if err := h.tasks.Update(t); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update task")
		return
	}
	JSON(w, http.StatusOK, t)
}

func (h *DeliverableHandler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("taskId")
	if err := h.tasks.Delete(taskID); err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete task")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

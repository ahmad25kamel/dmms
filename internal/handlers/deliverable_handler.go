package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"dmms/internal/middleware"
	"dmms/internal/models"
	"dmms/internal/repository"
	"dmms/internal/service"
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

func normalizeAcceptanceCriteria(input interface{}) string {
	if input == nil {
		return "[]"
	}
	switch v := input.(type) {
	case string:
		if v == "" {
			return "[]"
		}
		return v
	case []interface{}:
		b, _ := json.Marshal(v)
		return string(b)
	default:
		return "[]"
	}
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
		AcceptanceCriteria interface{}        `json:"acceptance_criteria"`
		MaxBudget          float64            `json:"max_budget"`
		StartDate          *string            `json:"start_date"`
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
		AcceptanceCriteria: normalizeAcceptanceCriteria(body.AcceptanceCriteria),
		MaxBudget:          body.MaxBudget,
		DependencyID:       body.DependencyID,
		Visibility:         body.Visibility,
	}
	if body.StartDate != nil && *body.StartDate != "" {
		dt, err := time.Parse("2006-01-02", *body.StartDate)
		if err == nil {
			d.StartDate = &dt
		}
	}
	if body.DueDate != nil && *body.DueDate != "" {
		dt, err := time.Parse("2006-01-02", *body.DueDate)
		if err == nil {
			d.DueDate = &dt
		}
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

func (h *DeliverableHandler) ListChildren(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	children, err := h.repo.ListChildren(id)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list children")
		return
	}
	if children == nil {
		children = []*models.Deliverable{}
	}
	JSON(w, http.StatusOK, children)
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
		AcceptanceCriteria interface{}       `json:"acceptance_criteria"`
		MaxBudget          float64           `json:"max_budget"`
		StartDate          *string           `json:"start_date"`
		DueDate            *string           `json:"due_date"`
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
	if body.AcceptanceCriteria != nil {
		d.AcceptanceCriteria = normalizeAcceptanceCriteria(body.AcceptanceCriteria)
	}
	if body.MaxBudget > 0 {
		d.MaxBudget = body.MaxBudget
	}
	if body.Visibility != "" {
		d.Visibility = body.Visibility
	}
	if body.StartDate != nil {
		if *body.StartDate == "" {
			d.StartDate = nil
		} else {
			dt, err := time.Parse("2006-01-02", *body.StartDate)
			if err == nil {
				d.StartDate = &dt
			}
		}
	}
	if body.DueDate != nil {
		if *body.DueDate == "" {
			d.DueDate = nil
		} else {
			dt, err := time.Parse("2006-01-02", *body.DueDate)
			if err == nil {
				d.DueDate = &dt
			}
		}
	}
	if err := h.repo.Update(d); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update deliverable")
		return
	}
	h.svc.SyncBudget(d.ProjectID)
	JSON(w, http.StatusOK, d)
}

func (h *DeliverableHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	d, err := h.repo.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "deliverable not found")
		return
	}
	if err := h.repo.Delete(id); err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete deliverable")
		return
	}
	h.svc.SyncBudget(d.ProjectID)
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
		Status:        models.KanbanBacklog,
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

// POST /projects/{projectId}/deliverables/import
type ImportTask struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type ImportDeliverable struct {
	Title              string              `json:"title"`
	Brief              string              `json:"brief"`
	Scope              string              `json:"scope"`
	AcceptanceCriteria interface{}       `json:"acceptance_criteria"`
	MaxBudget          float64             `json:"max_budget"`
	StartDate          *string             `json:"start_date"`
	DueDate            *string             `json:"due_date"`
	Visibility         models.Visibility   `json:"visibility"`
	Tasks              []ImportTask        `json:"tasks"`
	Children           []ImportDeliverable `json:"children"`
}

func (h *DeliverableHandler) ImportJSON(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("projectId")
	if projectID == "" {
		Err(w, http.StatusBadRequest, "project_id is required")
		return
	}
	userID := middleware.GetUserID(r)

	var body []ImportDeliverable
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var validate func(item ImportDeliverable) error
	validate = func(item ImportDeliverable) error {
		if item.Title == "" {
			return fmt.Errorf("all deliverables and sub-deliverables must have a title")
		}
		for _, child := range item.Children {
			if err := validate(child); err != nil {
				return err
			}
		}
		return nil
	}

	for _, item := range body {
		if err := validate(item); err != nil {
			Err(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	insertedCount := 0
	var processDeliverable func(item ImportDeliverable, parentID *string) error
	processDeliverable = func(item ImportDeliverable, parentID *string) error {
		d := &models.Deliverable{
			ProjectID:          projectID,
			ParentID:           parentID,
			Title:              item.Title,
			Brief:              item.Brief,
			Scope:              item.Scope,
			AcceptanceCriteria: normalizeAcceptanceCriteria(item.AcceptanceCriteria),
			MaxBudget:          item.MaxBudget,
			Visibility:         item.Visibility,
		}
		if d.AcceptanceCriteria == "" {
			d.AcceptanceCriteria = "[]"
		}
		if d.Visibility == "" {
			d.Visibility = models.VisibilityPublic
		}
		if item.StartDate != nil && *item.StartDate != "" {
			dt, err := time.Parse("2006-01-02", *item.StartDate)
			if err == nil {
				d.StartDate = &dt
			}
		}
		if item.DueDate != nil && *item.DueDate != "" {
			dt, err := time.Parse("2006-01-02", *item.DueDate)
			if err == nil {
				d.DueDate = &dt
			}
		}
		if err := h.svc.Create(d); err != nil {
			return fmt.Errorf("failed to create deliverable '%s': %v", item.Title, err)
		}
		insertedCount++

		// Create tasks
		fmt.Printf("DEBUG: Creating %d tasks for deliverable '%s'\n", len(item.Tasks), d.Title)
		for i, task := range item.Tasks {
			t := &models.Task{
				ID:            uuid.New().String(),
				DeliverableID: d.ID,
				ProjectID:     projectID,
				CreatedBy:     userID,
				Title:         task.Title,
				Description:   task.Description,
				Status:        models.KanbanBacklog,
				Position:      i,
			}
			if err := h.tasks.Create(t); err != nil {
				fmt.Printf("ERROR: Failed to create task '%s': %v\n", task.Title, err)
				return fmt.Errorf("failed to create task '%s': %v", task.Title, err)
			}
		}
		// Process children
		for _, child := range item.Children {
			if err := processDeliverable(child, &d.ID); err != nil {
				return err
			}
		}
		return nil
	}

	for _, item := range body {
		if err := processDeliverable(item, nil); err != nil {
			Err(w, http.StatusInternalServerError, err.Error())
			return
		}
	}

	h.svc.SyncBudget(projectID)
	JSON(w, http.StatusCreated, map[string]interface{}{"success": true, "count": insertedCount})
}

// GET /projects/{projectId}/deliverables/template
func (h *DeliverableHandler) DownloadTemplate(w http.ResponseWriter, r *http.Request) {
	template := []map[string]interface{}{
		{
			"title":               "Example Deliverable",
			"brief":               "Brief description of the deliverable",
			"scope":               "Scope of work",
			"acceptance_criteria": "[\"Criteria 1\", \"Criteria 2\"]",
			"max_budget":          1000.0,
			"start_date":          "2026-05-01",
			"due_date":            "2026-05-15",
			"visibility":          "public",
			"tasks": []map[string]string{
				{"title": "Initial Research", "description": "Gather context"},
				{"title": "Implementation", "description": "Write code"},
			},
			"children": []map[string]interface{}{
				{
					"title":               "Sub-deliverable",
					"brief":               "Smaller component",
					"scope":               "...",
					"acceptance_criteria": "[]",
					"max_budget":          500.0,
					"start_date":          "2026-05-01",
					"due_date":            "2026-05-07",
					"visibility":          "public",
					"tasks":               []map[string]string{},
				},
			},
		},
	}
	JSON(w, http.StatusOK, template)
}


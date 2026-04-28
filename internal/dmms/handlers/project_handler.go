package handlers

import (
	"net/http"
	"strings"

	"finance-game/internal/dmms/middleware"
	"finance-game/internal/dmms/models"
	"finance-game/internal/dmms/repository"

	"github.com/google/uuid"
)

type ProjectHandler struct {
	projects *repository.ProjectRepo
}

func NewProjectHandler(projects *repository.ProjectRepo) *ProjectHandler {
	return &ProjectHandler{projects: projects}
}

func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	role := middleware.GetRole(r)
	userID := middleware.GetUserID(r)
	var projects []*models.Project
	var err error
	if role == models.RoleAdmin {
		projects, err = h.projects.ListAll()
	} else {
		projects, err = h.projects.ListByPM(userID)
	}
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list projects")
		return
	}
	if projects == nil {
		projects = []*models.Project{}
	}
	JSON(w, http.StatusOK, projects)
}

func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		BudgetTotal float64 `json:"budget_total"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		Err(w, http.StatusBadRequest, "name is required")
		return
	}
	p := &models.Project{
		ID:          uuid.New().String(),
		Name:        body.Name,
		Description: body.Description,
		PMID:        middleware.GetUserID(r),
		BudgetTotal: body.BudgetTotal,
		Status:      models.ProjectDraft,
	}
	if err := h.projects.Create(p); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create project")
		return
	}
	JSON(w, http.StatusCreated, p)
}

func (h *ProjectHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, err := h.projects.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "project not found")
		return
	}
	JSON(w, http.StatusOK, p)
}

func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, err := h.projects.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "project not found")
		return
	}
	userID := middleware.GetUserID(r)
	if p.PMID != userID && middleware.GetRole(r) != models.RoleAdmin {
		Err(w, http.StatusForbidden, "not your project")
		return
	}
	var body struct {
		Name        string               `json:"name"`
		Description string               `json:"description"`
		BudgetTotal float64              `json:"budget_total"`
		Status      models.ProjectStatus `json:"status"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.Name != "" {
		p.Name = body.Name
	}
	p.Description = body.Description
	if body.BudgetTotal > 0 {
		p.BudgetTotal = body.BudgetTotal
	}
	if body.Status != "" {
		p.Status = body.Status
	}
	if err := h.projects.Update(p); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update project")
		return
	}
	JSON(w, http.StatusOK, p)
}

func (h *ProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, err := h.projects.FindByID(id)
	if err != nil {
		Err(w, http.StatusNotFound, "project not found")
		return
	}
	userID := middleware.GetUserID(r)
	if p.PMID != userID && middleware.GetRole(r) != models.RoleAdmin {
		Err(w, http.StatusForbidden, "not your project")
		return
	}
	if err := h.projects.Delete(id); err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete project")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

package handlers

import (
	"encoding/json"
	"net/http"

	"dmms/internal/middleware"
	"dmms/internal/models"
	"dmms/internal/repository"
)

type ArtifactHandler struct {
	artifacts    *repository.SubmissionArtifactRepo
	deliverables *repository.DeliverableRepo
}

func NewArtifactHandler(artifacts *repository.SubmissionArtifactRepo, deliverables *repository.DeliverableRepo) *ArtifactHandler {
	return &ArtifactHandler{artifacts: artifacts, deliverables: deliverables}
}

func (h *ArtifactHandler) List(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	items, err := h.artifacts.ListByDeliverable(id)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list artifacts")
		return
	}
	if items == nil {
		items = []*models.SubmissionArtifact{}
	}
	JSON(w, http.StatusOK, items)
}

func (h *ArtifactHandler) AddLink(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := middleware.GetUserID(r)

	var body struct {
		Kind   models.ArtifactKind `json:"kind"`
		URL    string              `json:"url"`
		Label  string              `json:"label"`
		TaskID *string             `json:"task_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if body.URL == "" {
		Err(w, http.StatusBadRequest, "url is required")
		return
	}
	if body.Kind != models.ArtifactLink && body.Kind != models.ArtifactFile {
		body.Kind = models.ArtifactLink
	}

	a := &models.SubmissionArtifact{
		DeliverableID: id,
		ContributorID: userID,
		TaskID:        body.TaskID,
		Kind:          body.Kind,
		URL:           body.URL,
		Label:         body.Label,
	}
	if err := h.artifacts.Create(a); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create artifact")
		return
	}

	// Re-fetch to get task_title via JOIN
	items, _ := h.artifacts.ListByDeliverable(id)
	for _, item := range items {
		if item.ID == a.ID {
			JSON(w, http.StatusCreated, item)
			return
		}
	}
	JSON(w, http.StatusCreated, a)
}

func (h *ArtifactHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := middleware.GetUserID(r)

	var taskID *string
	if tid := r.FormValue("task_id"); tid != "" {
		taskID = &tid
	}
	label := r.FormValue("label")

	var savedPath string
	handleFileUpload(w, r, func(fp string) error {
		savedPath = fp
		return nil
	})
	// handleFileUpload writes error response on failure; if savedPath is empty it already responded
	if savedPath == "" {
		return
	}

	a := &models.SubmissionArtifact{
		DeliverableID: id,
		ContributorID: userID,
		TaskID:        taskID,
		Kind:          models.ArtifactFile,
		URL:           savedPath,
		Label:         label,
	}
	if err := h.artifacts.Create(a); err != nil {
		Err(w, http.StatusInternalServerError, "failed to create artifact")
		return
	}

	// Re-fetch to get task_title
	items, _ := h.artifacts.ListByDeliverable(id)
	for _, item := range items {
		if item.ID == a.ID {
			JSON(w, http.StatusCreated, item)
			return
		}
	}
	JSON(w, http.StatusCreated, a)
}

func (h *ArtifactHandler) Delete(w http.ResponseWriter, r *http.Request) {
	artifactID := r.PathValue("artifactId")
	userID := middleware.GetUserID(r)

	deleted, err := h.artifacts.Delete(artifactID, userID)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete artifact")
		return
	}
	if !deleted {
		Err(w, http.StatusForbidden, "artifact not found or not yours")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

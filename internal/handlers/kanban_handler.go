package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"dmms/internal/middleware"
	"dmms/internal/models"
	"dmms/internal/repository"
	"github.com/google/uuid"
)

type KanbanHandler struct {
	tasks  *repository.TaskRepo
	kanban *repository.KanbanRepo
}

func NewKanbanHandler(tasks *repository.TaskRepo, kanban *repository.KanbanRepo) *KanbanHandler {
	return &KanbanHandler{tasks: tasks, kanban: kanban}
}

type taskListResponse struct {
	Items []*models.Task `json:"items"`
	Total int64          `json:"total"`
}

// GET /kanban?project_id=&limit=&offset=&status=
func (h *KanbanHandler) List(w http.ResponseWriter, r *http.Request) {
	projectID := r.URL.Query().Get("project_id")
	status := r.URL.Query().Get("status")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	var tasks []*models.Task
	var total int64
	var err error

	if projectID != "" {
		tasks, err = h.tasks.ListByProject(projectID, limit, offset, status)
		if err == nil {
			total, _ = h.tasks.CountByProject(projectID, status)
		}
	} else {
		tasks, err = h.tasks.ListAll(limit, offset, status)
		if err == nil {
			total, _ = h.tasks.CountAll(status)
		}
	}

	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	if tasks == nil {
		tasks = []*models.Task{}
	}
	h.populateMembers(tasks)
	JSON(w, http.StatusOK, taskListResponse{Items: tasks, Total: total})
}

// GET /kanban/mine (contributor view — all tasks for their deliverables)
func (h *KanbanHandler) Mine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	status := r.URL.Query().Get("status")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	tasks, err := h.tasks.ListForContributor(userID, limit, offset, status)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}
	if tasks == nil {
		tasks = []*models.Task{}
	}
	h.populateMembers(tasks)
	total, _ := h.tasks.CountForContributor(userID, status)
	JSON(w, http.StatusOK, taskListResponse{Items: tasks, Total: total})
}

func (h *KanbanHandler) populateMembers(tasks []*models.Task) {
	if len(tasks) == 0 {
		return
	}
	ids := make([]string, len(tasks))
	for i, t := range tasks {
		ids[i] = t.ID
	}
	memberMap, err := h.kanban.GetMembersForTasks(ids)
	if err != nil {
		return
	}
	for _, t := range tasks {
		if members, ok := memberMap[t.ID]; ok {
			t.Members = members
		} else {
			t.Members = []models.TaskMember{}
		}
	}
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

// GET /kanban/:id
func (h *KanbanHandler) GetOne(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	task, err := h.kanban.Get(id)
	if err != nil || task.ID == "" {
		Err(w, http.StatusNotFound, "task not found")
		return
	}
	JSON(w, http.StatusOK, task)
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
		// Auto-add newly assigned user to task members
		if *body.AssignedTo != "" {
			m := &models.TaskMember{
				ID:       uuid.New().String(),
				TaskID:   id,
				UserID:   *body.AssignedTo,
				JoinedAt: time.Now(),
			}
			_ = h.kanban.AddMember(m) // INSERT IGNORE — safe to ignore duplicate
		}
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
	// Re-fetch to get enriched fields (assigned_to_name, project_name, members, etc.)
	refreshed, err := h.kanban.Get(id)
	if err != nil {
		JSON(w, http.StatusOK, existing)
		return
	}
	JSON(w, http.StatusOK, refreshed)
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
		Body      string   `json:"body"`
		FilePaths []string `json:"file_uploads"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid body")
		return
	}

	pathsJSON := ""
	if len(body.FilePaths) > 0 {
		b, _ := json.Marshal(body.FilePaths)
		pathsJSON = string(b)
	}

	comment := &models.TaskComment{
		ID:        uuid.New().String(),
		TaskID:    taskID,
		AuthorID:  authorID,
		Body:      body.Body,
		FilePaths: pathsJSON,
	}
	newComment, err := h.tasks.CreateComment(comment)
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

// POST /kanban/:id/files
func (h *KanbanHandler) UploadTaskFile(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	handleFileUpload(w, r, func(fp string) error {
		t, err := h.tasks.Get(taskID)
		if err != nil { return err }
		var paths []string
		if t.FilePaths != "" && t.FilePaths != "[]" {
			if err := json.Unmarshal([]byte(t.FilePaths), &paths); err != nil {
				return fmt.Errorf("corrupt file_paths for task %s: %w", taskID, err)
			}
		}
		paths = append(paths, fp)
		b, err := json.Marshal(paths)
		if err != nil { return err }
		t.FilePaths = string(b)
		if err := h.tasks.Update(t); err != nil { return err }
		JSON(w, http.StatusOK, map[string]string{"path": fp})
		return nil
	})
}

// POST /kanban/comments/:id/files
func (h *KanbanHandler) UploadCommentFile(w http.ResponseWriter, r *http.Request) {
	commentID := r.PathValue("id")
	handleFileUpload(w, r, func(fp string) error {
		c, err := h.tasks.GetComment(commentID)
		if err != nil { return err }
		var paths []string
		if c.FilePaths != "" && c.FilePaths != "[]" {
			if err := json.Unmarshal([]byte(c.FilePaths), &paths); err != nil {
				return fmt.Errorf("corrupt file_paths for comment %s: %w", commentID, err)
			}
		}
		paths = append(paths, fp)
		b, err := json.Marshal(paths)
		if err != nil { return err }
		c.FilePaths = string(b)
		if err := h.tasks.UpdateComment(c); err != nil { return err }
		JSON(w, http.StatusOK, map[string]string{"path": fp})
		return nil
	})
}

// POST /api/dmms/files (Generic upload)
func (h *KanbanHandler) UploadGeneric(w http.ResponseWriter, r *http.Request) {
	handleFileUpload(w, r, func(filepath string) error {
		JSON(w, http.StatusOK, map[string]string{"path": filepath})
		return nil
	})
}

// POST /kanban/{id}/members — join task as a member
func (h *KanbanHandler) JoinTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := middleware.GetUserID(r)
	m := &models.TaskMember{
		ID:       uuid.New().String(),
		TaskID:   id,
		UserID:   userID,
		JoinedAt: time.Now(),
	}
	if err := h.kanban.AddMember(m); err != nil {
		Err(w, http.StatusInternalServerError, "failed to join task")
		return
	}
	members, err := h.kanban.GetMembers(id)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to fetch members")
		return
	}
	JSON(w, http.StatusOK, members)
}

// DELETE /kanban/{id}/members — leave task
func (h *KanbanHandler) LeaveTask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	userID := middleware.GetUserID(r)
	if err := h.kanban.RemoveMember(id, userID); err != nil {
		Err(w, http.StatusInternalServerError, "failed to leave task")
		return
	}
	members, err := h.kanban.GetMembers(id)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to fetch members")
		return
	}
	JSON(w, http.StatusOK, members)
}

func handleFileUpload(w http.ResponseWriter, r *http.Request, updateFn func(string) error) {
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20) // 5 MB
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		Err(w, http.StatusBadRequest, "file too large or invalid")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		Err(w, http.StatusBadRequest, "file required")
		return
	}
	defer file.Close()

	os.MkdirAll("uploads", os.ModePerm)
	ext := filepath.Ext(header.Filename)
	newFilename := uuid.New().String() + ext
	path := filepath.Join("uploads", newFilename)
	dst, err := os.Create(path)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to save file")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, file); err != nil {
		Err(w, http.StatusInternalServerError, "failed to save file")
		return
	}

	if err := updateFn("/" + path); err != nil {
		Err(w, http.StatusInternalServerError, "failed to link file")
		return
	}
}

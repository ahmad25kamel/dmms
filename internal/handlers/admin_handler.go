package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"dmms/internal/middleware"
	"dmms/internal/models"
	"dmms/internal/repository"
)

type AdminHandler struct {
	users *repository.UserRepo
	audit *repository.AuditRepo
}

func NewAdminHandler(users *repository.UserRepo, audit *repository.AuditRepo) *AdminHandler {
	return &AdminHandler{users: users, audit: audit}
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 {
		limit = 20
	}
	users, total, err := h.users.ListPaged(limit, offset)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	if users == nil {
		users = []*models.User{}
	}
	JSON(w, http.StatusOK, map[string]any{"items": users, "total": total, "limit": limit, "offset": offset})
}

func (h *AdminHandler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		Role models.Role `json:"role"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	target, _ := h.users.FindByID(id)
	if err := h.users.UpdateRole(id, body.Role); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update role")
		return
	}
	targetName := id
	if target != nil {
		targetName = target.Name
	}
	h.audit.Log(middleware.GetUserID(r), "user.role_update", "user", id, targetName,
		fmt.Sprintf(`{"new_role":"%s"}`, body.Role))
	JSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	target, _ := h.users.FindByID(id)
	if err := h.users.Delete(id); err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete user")
		return
	}
	targetName := id
	if target != nil {
		targetName = target.Name
	}
	h.audit.Log(middleware.GetUserID(r), "user.delete", "user", id, targetName, "")
	JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

func (h *AdminHandler) ListPendingUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.users.ListPending()
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list pending users")
		return
	}
	if users == nil {
		users = []*models.User{}
	}
	JSON(w, http.StatusOK, users)
}

func (h *AdminHandler) ApproveUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	target, _ := h.users.FindByID(id)
	if err := h.users.SetApproved(id, true); err != nil {
		Err(w, http.StatusInternalServerError, "failed to approve user")
		return
	}
	targetName := id
	if target != nil {
		targetName = target.Name
	}
	h.audit.Log(middleware.GetUserID(r), "user.approve", "user", id, targetName, "")
	JSON(w, http.StatusOK, map[string]bool{"approved": true})
}

func (h *AdminHandler) RejectUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	target, _ := h.users.FindByID(id)
	if err := h.users.Delete(id); err != nil {
		Err(w, http.StatusInternalServerError, "failed to reject user")
		return
	}
	targetName := id
	if target != nil {
		targetName = target.Name
	}
	h.audit.Log(middleware.GetUserID(r), "user.reject", "user", id, targetName, "")
	JSON(w, http.StatusOK, map[string]bool{"rejected": true})
}

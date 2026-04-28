package handlers

import (
	"net/http"

	"finance-game/internal/dmms/models"
	"finance-game/internal/dmms/repository"
)

type AdminHandler struct {
	users *repository.UserRepo
}

func NewAdminHandler(users *repository.UserRepo) *AdminHandler {
	return &AdminHandler{users: users}
}

func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.users.List()
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	if users == nil {
		users = []*models.User{}
	}
	JSON(w, http.StatusOK, users)
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
	if err := h.users.UpdateRole(id, body.Role); err != nil {
		Err(w, http.StatusInternalServerError, "failed to update role")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"updated": true})
}

func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.users.Delete(id); err != nil {
		Err(w, http.StatusInternalServerError, "failed to delete user")
		return
	}
	JSON(w, http.StatusOK, map[string]bool{"deleted": true})
}

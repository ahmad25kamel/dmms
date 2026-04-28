package handlers

import (
	"net/http"
	"strings"

	"finance-game/internal/dmms/middleware"
	"finance-game/internal/dmms/models"
	"finance-game/internal/dmms/repository"
	"finance-game/internal/dmms/service"
)

type AuthHandler struct {
	auth  *service.AuthService
	users *repository.UserRepo
}

func NewAuthHandler(auth *service.AuthService, users *repository.UserRepo) *AuthHandler {
	return &AuthHandler{auth: auth, users: users}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string      `json:"email"`
		Name     string      `json:"name"`
		Password string      `json:"password"`
		Role     models.Role `json:"role"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Email == "" || body.Password == "" || body.Name == "" {
		Err(w, http.StatusBadRequest, "email, name, and password are required")
		return
	}
	if len(body.Password) < 8 {
		Err(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if body.Role != models.RolePM && body.Role != models.RoleContributor {
		body.Role = models.RoleContributor
	}
	u, err := h.auth.Register(body.Email, body.Name, body.Password, body.Role)
	if err != nil {
		Err(w, http.StatusConflict, "email already in use")
		return
	}
	JSON(w, http.StatusCreated, u)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	u, token, err := h.auth.Login(body.Email, body.Password)
	if err != nil {
		Err(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	JSON(w, http.StatusOK, map[string]interface{}{"user": u, "token": token})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	u, err := h.users.FindByID(userID)
	if err != nil {
		Err(w, http.StatusNotFound, "user not found")
		return
	}
	JSON(w, http.StatusOK, u)
}

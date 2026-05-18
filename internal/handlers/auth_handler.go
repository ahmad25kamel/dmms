package handlers

import (
	"net/http"
	"regexp"
	"strings"

	"dmms/internal/middleware"
	"dmms/internal/models"
	"dmms/internal/repository"
	"dmms/internal/service"
)

var usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_]{3,30}$`)

type AuthHandler struct {
	auth  *service.AuthService
	users *repository.UserRepo
}

func NewAuthHandler(auth *service.AuthService, users *repository.UserRepo) *AuthHandler {
	return &AuthHandler{auth: auth, users: users}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string      `json:"username"`
		Email    string      `json:"email"`
		Name     string      `json:"name"`
		Password string      `json:"password"`
		Role     models.Role `json:"role"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Username == "" || body.Password == "" || body.Name == "" {
		Err(w, http.StatusBadRequest, "username, name, and password are required")
		return
	}
	if !usernameRe.MatchString(body.Username) {
		Err(w, http.StatusBadRequest, "username must be 3-30 alphanumeric characters or underscores")
		return
	}
	if len(body.Password) < 8 {
		Err(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	if body.Role != models.RolePM && body.Role != models.RoleContributor {
		Err(w, http.StatusBadRequest, "role must be 'pm' or 'contributor'")
		return
	}
	u, err := h.auth.Register(body.Username, body.Email, body.Name, body.Password, body.Role)
	if err != nil {
		Err(w, http.StatusConflict, "username already in use")
		return
	}
	JSON(w, http.StatusCreated, u)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := Decode(r, &body); err != nil {
		Err(w, http.StatusBadRequest, "invalid request body")
		return
	}
	u, token, err := h.auth.Login(body.Username, body.Password)
	if err != nil {
		msg := "invalid credentials"
		if err.Error() == "account pending approval" {
			msg = "account pending approval"
		}
		Err(w, http.StatusUnauthorized, msg)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"user": u, "token": token})
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

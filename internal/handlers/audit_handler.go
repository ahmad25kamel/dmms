package handlers

import (
	"net/http"
	"strconv"

	"dmms/internal/models"
	"dmms/internal/repository"
)

type AuditHandler struct {
	audit *repository.AuditRepo
}

func NewAuditHandler(audit *repository.AuditRepo) *AuditHandler {
	return &AuditHandler{audit: audit}
}

func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 {
		limit = 50
	}

	f := repository.AuditFilter{
		EntityType: r.URL.Query().Get("entity_type"),
		Action:     r.URL.Query().Get("action"),
		UserID:     r.URL.Query().Get("user_id"),
	}

	logs, total, err := h.audit.List(limit, offset, f)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list audit logs")
		return
	}
	if logs == nil {
		logs = []*models.AuditLog{}
	}
	JSON(w, http.StatusOK, map[string]any{"items": logs, "total": total, "limit": limit, "offset": offset})
}

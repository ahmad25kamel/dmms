package handlers

import (
	"net/http"

	"finance-game/internal/dmms/middleware"
	"finance-game/internal/dmms/models"
	"finance-game/internal/dmms/repository"
)

type RewardHandler struct {
	rewards *repository.RewardRepo
}

func NewRewardHandler(rewards *repository.RewardRepo) *RewardHandler {
	return &RewardHandler{rewards: rewards}
}

func (h *RewardHandler) Ledger(w http.ResponseWriter, r *http.Request) {
	role := middleware.GetRole(r)
	userID := middleware.GetUserID(r)

	var entries []*models.RewardLedgerEntry
	var err error

	if role == models.RoleAdmin || role == models.RolePM {
		if uid := r.URL.Query().Get("user_id"); uid != "" {
			entries, err = h.rewards.ListByUser(uid)
		} else {
			entries, err = h.rewards.ListAll()
		}
	} else {
		entries, err = h.rewards.ListByUser(userID)
	}

	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list ledger")
		return
	}
	if entries == nil {
		entries = []*models.RewardLedgerEntry{}
	}

	total, _ := h.rewards.SumByUser(userID)
	JSON(w, http.StatusOK, map[string]interface{}{"entries": entries, "total": total})
}

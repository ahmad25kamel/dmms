package handlers

import (
	"net/http"

	"dmms/internal/models"
	"dmms/internal/repository"
)

type MarketplaceHandler struct {
	deliverables *repository.DeliverableRepo
}

func NewMarketplaceHandler(deliverables *repository.DeliverableRepo) *MarketplaceHandler {
	return &MarketplaceHandler{deliverables: deliverables}
}

func (h *MarketplaceHandler) ListBids(w http.ResponseWriter, r *http.Request) {
	visibility := models.VisibilityPublic
	if v := r.URL.Query().Get("visibility"); v == "all" {
		visibility = ""
	}
	bids, err := h.deliverables.ListOpenBids(visibility)
	if err != nil {
		Err(w, http.StatusInternalServerError, "failed to list bids")
		return
	}
	if bids == nil {
		bids = []*models.Deliverable{}
	}
	JSON(w, http.StatusOK, bids)
}

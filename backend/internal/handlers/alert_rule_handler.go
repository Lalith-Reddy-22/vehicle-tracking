package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mapup/vehicle-tracking/internal/models"
	"github.com/mapup/vehicle-tracking/internal/repositories"
	"github.com/mapup/vehicle-tracking/internal/utils"
)

// AlertRuleHandler handles /alert-rules routes.
type AlertRuleHandler struct {
	repo *repositories.AlertRuleRepository
}

// NewAlertRuleHandler creates a new AlertRuleHandler.
func NewAlertRuleHandler(repo *repositories.AlertRuleRepository) *AlertRuleHandler {
	return &AlertRuleHandler{repo: repo}
}

// Create handles POST /alert-rules.
func (h *AlertRuleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateAlertRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid_json", "Request body is not valid JSON")
		return
	}

	switch req.EventType {
	case models.AlertEventEnter, models.AlertEventExit, models.AlertEventBoth:
		// valid
	default:
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error",
			"event_type must be one of: enter, exit, both")
		return
	}

	rule, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.JSON(w, http.StatusCreated, rule)
}

// List handles GET /alert-rules.
func (h *AlertRuleHandler) List(w http.ResponseWriter, r *http.Request) {
	rules, err := h.repo.List(r.Context())
	if err != nil {
		utils.InternalError(w)
		return
	}
	if rules == nil {
		rules = []models.AlertRule{}
	}
	utils.JSON(w, http.StatusOK, map[string]any{"data": rules})
}

// RegisterRoutes mounts alert-rule routes.
func (h *AlertRuleHandler) RegisterRoutes(r chi.Router) {
	r.Post("/alert-rules", h.Create)
	r.Get("/alert-rules", h.List)
}

package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/mapup/vehicle-tracking/internal/models"
	"github.com/mapup/vehicle-tracking/internal/repositories"
	"github.com/mapup/vehicle-tracking/internal/utils"
)

// ViolationHandler handles /violations routes.
type ViolationHandler struct {
	repo *repositories.ViolationRepository
}

// NewViolationHandler creates a new ViolationHandler.
func NewViolationHandler(repo *repositories.ViolationRepository) *ViolationHandler {
	return &ViolationHandler{repo: repo}
}

// History handles GET /violations/history.
func (h *ViolationHandler) History(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	req := &models.ViolationHistoryRequest{
		VehicleID:  q.Get("vehicle_id"),
		GeofenceID: q.Get("geofence_id"),
		EventType:  q.Get("event_type"),
		Limit:      50,
		Offset:     0,
	}

	// Validate event_type if provided.
	if req.EventType != "" && req.EventType != "enter" && req.EventType != "exit" {
		utils.Error(w, http.StatusBadRequest, "invalid_event_type", "event_type must be 'enter' or 'exit'")
		return
	}

	// Parse limit.
	if lStr := q.Get("limit"); lStr != "" {
		l, err := strconv.Atoi(lStr)
		if err != nil || l < 1 {
			utils.Error(w, http.StatusBadRequest, "invalid_limit", "limit must be a positive integer")
			return
		}
		if l > 500 {
			l = 500
		}
		req.Limit = l
	}

	// Parse offset.
	if oStr := q.Get("offset"); oStr != "" {
		o, err := strconv.Atoi(oStr)
		if err != nil || o < 0 {
			utils.Error(w, http.StatusBadRequest, "invalid_offset", "offset must be a non-negative integer")
			return
		}
		req.Offset = o
	}

	// Parse start/end timestamps (RFC3339).
	if sStr := q.Get("start"); sStr != "" {
		t, err := time.Parse(time.RFC3339, sStr)
		if err != nil {
			utils.Error(w, http.StatusBadRequest, "invalid_start", "start must be RFC3339 format, e.g. 2026-01-01T00:00:00Z")
			return
		}
		req.StartTime = &t
	}
	if eStr := q.Get("end"); eStr != "" {
		t, err := time.Parse(time.RFC3339, eStr)
		if err != nil {
			utils.Error(w, http.StatusBadRequest, "invalid_end", "end must be RFC3339 format, e.g. 2026-12-31T23:59:59Z")
			return
		}
		req.EndTime = &t
	}

	violations, total, err := h.repo.History(r.Context(), req)
	if err != nil {
		utils.InternalError(w)
		return
	}

	if violations == nil {
		violations = []models.Violation{}
	}

	utils.JSON(w, http.StatusOK, models.ViolationHistoryResponse{
		Data:       violations,
		TotalCount: total,
		Limit:      req.Limit,
		Offset:     req.Offset,
	})
}

// RegisterRoutes mounts violation routes.
func (h *ViolationHandler) RegisterRoutes(r chi.Router) {
	r.Get("/violations/history", h.History)
}

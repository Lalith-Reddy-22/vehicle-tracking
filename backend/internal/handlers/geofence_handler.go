// Package handlers contains HTTP request handlers.
// Each handler is responsible only for:
//   1. Parsing the request.
//   2. Calling the service or repository.
//   3. Writing the response.
// Business logic lives in services; database logic lives in repositories.
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mapup/vehicle-tracking/internal/geospatial"
	"github.com/mapup/vehicle-tracking/internal/models"
	"github.com/mapup/vehicle-tracking/internal/repositories"
	"github.com/mapup/vehicle-tracking/internal/utils"
)

// GeofenceHandler handles /geofences routes.
type GeofenceHandler struct {
	repo *repositories.GeofenceRepository
}

// NewGeofenceHandler creates a new GeofenceHandler.
func NewGeofenceHandler(repo *repositories.GeofenceRepository) *GeofenceHandler {
	return &GeofenceHandler{repo: repo}
}

// Create handles POST /geofences.
func (h *GeofenceHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateGeofenceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid_json", "Request body is not valid JSON")
		return
	}

	// Field validation.
	if req.Name == "" {
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error", "name is required")
		return
	}
	switch req.Category {
	case models.CategoryDeliveryZone, models.CategoryRestrictedZone,
		models.CategoryTollZone, models.CategoryCustomerArea:
		// valid
	default:
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error",
			"category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area")
		return
	}

	// Polygon validation — coordinates come in as [[lat, lon], ...].
	if err := geospatial.ValidatePolygonCoords(req.Coordinates); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid_polygon", err.Error())
		return
	}

	geofence, err := h.repo.Create(r.Context(), req.Name, req.Category, req.Coordinates)
	if err != nil {
		utils.InternalError(w)
		return
	}

	utils.JSON(w, http.StatusCreated, geofence)
}

// List handles GET /geofences.
// Accepts an optional ?category= query parameter.
func (h *GeofenceHandler) List(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	if category != "" {
		switch models.GeofenceCategory(category) {
		case models.CategoryDeliveryZone, models.CategoryRestrictedZone,
			models.CategoryTollZone, models.CategoryCustomerArea:
			// valid
		default:
			utils.Error(w, http.StatusBadRequest, "invalid_category",
				"category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area")
			return
		}
	}

	geofences, err := h.repo.List(r.Context(), category)
	if err != nil {
		utils.InternalError(w)
		return
	}

	if geofences == nil {
		geofences = []models.Geofence{}
	}

	utils.JSON(w, http.StatusOK, map[string]any{"data": geofences})
}

// Update handles PATCH /geofences/{id}.
func (h *GeofenceHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.UpdateGeofenceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid_json", "Request body is not valid JSON")
		return
	}
	if req.Category != "" {
		switch req.Category {
		case models.CategoryDeliveryZone, models.CategoryRestrictedZone,
			models.CategoryTollZone, models.CategoryCustomerArea:
		default:
			utils.Error(w, http.StatusUnprocessableEntity, "validation_error",
				"category must be one of: delivery_zone, restricted_zone, toll_zone, customer_area")
			return
		}
	}

	geofence, err := h.repo.Update(r.Context(), id, req.Name, req.Category)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if geofence == nil {
		utils.Error(w, http.StatusNotFound, "not_found", "Geofence not found")
		return
	}
	utils.JSON(w, http.StatusOK, geofence)
}

// Delete handles DELETE /geofences/{id}.
func (h *GeofenceHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	found, err := h.repo.Delete(r.Context(), id)
	if err != nil {
		utils.InternalError(w)
		return
	}
	if !found {
		utils.Error(w, http.StatusNotFound, "not_found", "Geofence not found")
		return
	}
	utils.JSON(w, http.StatusOK, map[string]string{"message": "Geofence deleted"})
}

// RegisterRoutes mounts geofence routes onto the given Chi router.
func (h *GeofenceHandler) RegisterRoutes(r chi.Router) {
	r.Post("/geofences", h.Create)
	r.Get("/geofences", h.List)
	r.Patch("/geofences/{id}", h.Update)
	r.Delete("/geofences/{id}", h.Delete)
}

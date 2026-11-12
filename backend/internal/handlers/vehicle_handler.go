package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/mapup/vehicle-tracking/internal/models"
	"github.com/mapup/vehicle-tracking/internal/repositories"
	"github.com/mapup/vehicle-tracking/internal/services"
	"github.com/mapup/vehicle-tracking/internal/utils"
)

// VehicleHandler handles /vehicles routes.
type VehicleHandler struct {
	repo    *repositories.VehicleRepository
	locSvc  *services.LocationService
}

// NewVehicleHandler creates a new VehicleHandler.
func NewVehicleHandler(repo *repositories.VehicleRepository, locSvc *services.LocationService) *VehicleHandler {
	return &VehicleHandler{repo: repo, locSvc: locSvc}
}

// Create handles POST /vehicles.
func (h *VehicleHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req models.CreateVehicleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid_json", "Request body is not valid JSON")
		return
	}

	// Validate required fields.
	if strings.TrimSpace(req.VehicleNumber) == "" {
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error", "vehicle_number is required")
		return
	}
	if strings.TrimSpace(req.DriverName) == "" {
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error", "driver_name is required")
		return
	}
	if strings.TrimSpace(req.VehicleType) == "" {
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error", "vehicle_type is required")
		return
	}
	if strings.TrimSpace(req.Phone) == "" {
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error", "phone is required")
		return
	}

	vehicle, err := h.repo.Create(r.Context(), &req)
	if err != nil {
		if err == repositories.ErrDuplicateVehicleNumber {
			utils.Error(w, http.StatusConflict, "duplicate_vehicle",
				"A vehicle with this vehicle_number is already registered")
			return
		}
		utils.InternalError(w)
		return
	}

	utils.JSON(w, http.StatusCreated, vehicle)
}

// List handles GET /vehicles.
func (h *VehicleHandler) List(w http.ResponseWriter, r *http.Request) {
	vehicles, err := h.repo.List(r.Context())
	if err != nil {
		utils.InternalError(w)
		return
	}
	if vehicles == nil {
		vehicles = []models.Vehicle{}
	}
	utils.JSON(w, http.StatusOK, map[string]any{"data": vehicles})
}

// UpdateLocation handles POST /vehicles/location.
func (h *VehicleHandler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	var req models.UpdateLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid_json", "Request body is not valid JSON")
		return
	}

	if strings.TrimSpace(req.VehicleID) == "" {
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error", "vehicle_id is required")
		return
	}
	if req.Timestamp.IsZero() {
		utils.Error(w, http.StatusUnprocessableEntity, "validation_error", "timestamp is required")
		return
	}

	// Coordinate range validation.
	if req.Latitude < -90 || req.Latitude > 90 {
		utils.Error(w, http.StatusBadRequest, "invalid_coordinates", "latitude must be between -90 and 90")
		return
	}
	if req.Longitude < -180 || req.Longitude > 180 {
		utils.Error(w, http.StatusBadRequest, "invalid_coordinates", "longitude must be between -180 and 180")
		return
	}

	resp, err := h.locSvc.UpdateLocation(r.Context(), &req)
	if err != nil {
		switch err {
		case services.ErrVehicleNotFound:
			utils.Error(w, http.StatusNotFound, "not_found", "Vehicle not found")
		case services.ErrOutOfOrderTimestamp:
			utils.Error(w, http.StatusConflict, "out_of_order", "Location timestamp is older than the latest accepted update")
		default:
			utils.InternalError(w)
		}
		return
	}

	utils.JSON(w, http.StatusOK, resp)
}

// GetCurrentLocation handles GET /vehicles/location/{id}.
func (h *VehicleHandler) GetCurrentLocation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		utils.Error(w, http.StatusBadRequest, "invalid_request", "vehicle id is required")
		return
	}

	resp, err := h.locSvc.GetCurrentLocation(r.Context(), id)
	if err != nil {
		if err == services.ErrVehicleNotFound {
			utils.Error(w, http.StatusNotFound, "not_found", "Vehicle not found")
			return
		}
		utils.InternalError(w)
		return
	}

	utils.JSON(w, http.StatusOK, resp)
}

// RegisterRoutes mounts vehicle routes onto the given Chi router.
func (h *VehicleHandler) RegisterRoutes(r chi.Router) {
	r.Post("/vehicles", h.Create)
	r.Get("/vehicles", h.List)
	r.Post("/vehicles/location", h.UpdateLocation)
	r.Get("/vehicles/location/{id}", h.GetCurrentLocation)
}

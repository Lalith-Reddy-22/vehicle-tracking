// Package models defines the domain structs that flow between layers.
// These are plain Go structs — no ORM magic, no database tags except for
// pgx scanning. JSON tags follow the exact API contract.
package models

import "time"

// ─── Geofence ────────────────────────────────────────────────────────────────

// GeofenceCategory enumerates the supported polygon categories.
type GeofenceCategory string

const (
	CategoryDeliveryZone  GeofenceCategory = "delivery_zone"
	CategoryRestrictedZone GeofenceCategory = "restricted_zone"
	CategoryTollZone       GeofenceCategory = "toll_zone"
	CategoryCustomerArea   GeofenceCategory = "customer_area"
)

// Coordinate is a [latitude, longitude] pair in the API's external format.
// PostGIS stores them as [longitude, latitude] — conversions happen only in
// the geospatial package.
type Coordinate struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// Geofence is the domain model for a geofenced area.
type Geofence struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Category    GeofenceCategory `json:"category"`
	Coordinates []Coordinate     `json:"coordinates"` // [lat, lon] order
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

// CreateGeofenceRequest is the inbound payload for POST /geofences.
// Coordinates are [latitude, longitude] as required by the API spec.
type CreateGeofenceRequest struct {
	Name        string           `json:"name"`
	Category    GeofenceCategory `json:"category"`
	Coordinates [][]float64      `json:"coordinates"` // [[lat,lon], ...]
}

// ─── Vehicle ─────────────────────────────────────────────────────────────────

// Vehicle is the domain model for a registered vehicle.
type Vehicle struct {
	ID            string    `json:"id"`
	VehicleNumber string    `json:"vehicle_number"`
	DriverName    string    `json:"driver_name"`
	VehicleType   string    `json:"vehicle_type"`
	Phone         string    `json:"phone"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// CreateVehicleRequest is the inbound payload for POST /vehicles.
type CreateVehicleRequest struct {
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
	VehicleType   string `json:"vehicle_type"`
	Phone         string `json:"phone"`
}

// UpdateVehicleRequest is the inbound payload for PATCH /vehicles/{id}.
// All fields are optional — only non-empty values are applied.
// vehicle_number is intentionally NOT updatable (would break violation history).
type UpdateVehicleRequest struct {
	DriverName  string `json:"driver_name"`
	VehicleType string `json:"vehicle_type"`
	Phone       string `json:"phone"`
}

// UpdateGeofenceRequest is the inbound payload for PATCH /geofences/{id}.
// Coordinates are NOT updatable after creation.
type UpdateGeofenceRequest struct {
	Name     string           `json:"name"`
	Category GeofenceCategory `json:"category"`
}

// UpdateAlertRuleRequest is the inbound payload for PATCH /alert-rules/{id}.
type UpdateAlertRuleRequest struct {
	Name      string         `json:"name"`
	EventType AlertEventType `json:"event_type"`
	IsActive  *bool          `json:"is_active"`
}

// VehicleLocation stores the latest accepted GPS fix for a vehicle.
type VehicleLocation struct {
	VehicleID string    `json:"vehicle_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpdateLocationRequest is the inbound payload for POST /vehicles/location.
type UpdateLocationRequest struct {
	VehicleID string    `json:"vehicle_id"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

// GeofenceRef is a lightweight reference used inside location responses.
type GeofenceRef struct {
	ID       string           `json:"id"`
	Name     string           `json:"name"`
	Category GeofenceCategory `json:"category"`
}

// LocationEvent describes a single entry or exit event detected during a
// location update.
type LocationEvent struct {
	GeofenceID   string           `json:"geofence_id"`
	GeofenceName string           `json:"geofence_name"`
	Category     GeofenceCategory `json:"category"`
	EventType    string           `json:"event_type"` // "enter" | "exit"
	AlertSent    bool             `json:"alert_sent"`
}

// UpdateLocationResponse is the response body for POST /vehicles/location.
type UpdateLocationResponse struct {
	Location       VehicleLocation `json:"location"`
	InsideGeofences []GeofenceRef  `json:"inside_geofences"`
	Events         []LocationEvent `json:"events"`
}

// CurrentLocationResponse is the response body for GET /vehicles/location/{id}.
type CurrentLocationResponse struct {
	Vehicle        Vehicle         `json:"vehicle"`
	Location       *VehicleLocation `json:"location"`
	InsideGeofences []GeofenceRef  `json:"inside_geofences"`
}

// ─── Alert Rules ─────────────────────────────────────────────────────────────

// AlertEventType enumerates the supported event types for alert rules.
type AlertEventType string

const (
	AlertEventEnter AlertEventType = "enter"
	AlertEventExit  AlertEventType = "exit"
	AlertEventBoth  AlertEventType = "both"
)

// AlertRule defines when a notification should fire.
type AlertRule struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	VehicleID  *string        `json:"vehicle_id"`  // nil = all vehicles
	GeofenceID *string        `json:"geofence_id"` // nil = all geofences
	EventType  AlertEventType `json:"event_type"`
	IsActive   bool           `json:"is_active"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
}

// CreateAlertRuleRequest is the inbound payload for POST /alert-rules.
type CreateAlertRuleRequest struct {
	Name       string         `json:"name"`
	VehicleID  *string        `json:"vehicle_id"`  // omit or null for all vehicles
	GeofenceID *string        `json:"geofence_id"` // omit or null for all geofences
	EventType  AlertEventType `json:"event_type"`
	IsActive   *bool          `json:"is_active"` // defaults to true
}

// ─── Violations ──────────────────────────────────────────────────────────────

// Violation records a single entry or exit boundary crossing.
type Violation struct {
	ID             string    `json:"id"`
	VehicleID      string    `json:"vehicle_id"`
	VehicleNumber  string    `json:"vehicle_number"`
	DriverName     string    `json:"driver_name"`
	GeofenceID     string    `json:"geofence_id"`
	GeofenceName   string    `json:"geofence_name"`
	Category       GeofenceCategory `json:"category"`
	EventType      string    `json:"event_type"`
	Timestamp      time.Time `json:"timestamp"`
	AlertTriggered bool      `json:"alert_triggered"`
	CreatedAt      time.Time `json:"created_at"`
}

// ViolationHistoryRequest holds query parameters for GET /violations/history.
type ViolationHistoryRequest struct {
	VehicleID  string
	GeofenceID string
	EventType  string
	StartTime  *time.Time
	EndTime    *time.Time
	Limit      int
	Offset     int
}

// ViolationHistoryResponse is the paginated response for violation history.
type ViolationHistoryResponse struct {
	Data       []Violation `json:"data"`
	TotalCount int64       `json:"total_count"`
	Limit      int         `json:"limit"`
	Offset     int         `json:"offset"`
}

// ─── WebSocket Alert ─────────────────────────────────────────────────────────

// WSAlert is the payload broadcast to connected WebSocket clients.
type WSAlert struct {
	Event        string    `json:"event"`
	VehicleID    string    `json:"vehicle_id"`
	VehicleNumber string   `json:"vehicle_number"`
	GeofenceID   string    `json:"geofence_id"`
	GeofenceName string    `json:"geofence_name"`
	EventType    string    `json:"event_type"`
	Timestamp    time.Time `json:"timestamp"`
	Message      string    `json:"message"`
}

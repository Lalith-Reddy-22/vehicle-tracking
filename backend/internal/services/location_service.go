// Package services contains all business logic.
// The LocationService owns the most complex flow in the system: GPS ingestion,
// geofence state diffing, violation persistence, and alert evaluation.
// All database mutations happen in a single transaction to maintain atomicity.
package services

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mapup/vehicle-tracking/internal/models"
	"github.com/mapup/vehicle-tracking/internal/repositories"
	ws "github.com/mapup/vehicle-tracking/internal/websocket"
	"github.com/rs/zerolog/log"
)

// LocationService handles all business logic for vehicle location updates.
type LocationService struct {
	pool        *pgxpool.Pool
	geoRepo     *repositories.GeofenceRepository
	locRepo     *repositories.LocationRepository
	violRepo    *repositories.ViolationRepository
	alertRepo   *repositories.AlertRuleRepository
	vehicleRepo *repositories.VehicleRepository
	hub         *ws.Hub
}

// NewLocationService creates a LocationService with its dependencies injected.
func NewLocationService(
	pool *pgxpool.Pool,
	geoRepo *repositories.GeofenceRepository,
	locRepo *repositories.LocationRepository,
	violRepo *repositories.ViolationRepository,
	alertRepo *repositories.AlertRuleRepository,
	vehicleRepo *repositories.VehicleRepository,
	hub *ws.Hub,
) *LocationService {
	return &LocationService{
		pool:        pool,
		geoRepo:     geoRepo,
		locRepo:     locRepo,
		violRepo:    violRepo,
		alertRepo:   alertRepo,
		vehicleRepo: vehicleRepo,
		hub:         hub,
	}
}

// UpdateLocation processes a GPS fix and returns the updated location plus
// detected geofence events.
//
// The entire operation is wrapped in a serializable transaction (READ COMMITTED
// + FOR UPDATE on the vehicle location row) to prevent concurrent updates for
// the same vehicle from producing duplicate events.
func (s *LocationService) UpdateLocation(ctx context.Context, req *models.UpdateLocationRequest) (*models.UpdateLocationResponse, error) {
	// ── 1. Verify vehicle exists (outside transaction — read-only) ──────────
	vehicle, err := s.vehicleRepo.GetByID(ctx, req.VehicleID)
	if err != nil {
		return nil, fmt.Errorf("lookup vehicle: %w", err)
	}
	if vehicle == nil {
		return nil, ErrVehicleNotFound
	}

	// ── 2. Spatial query: which geofences contain the new point? ────────────
	// This is done outside the transaction because it is a read-only spatial
	// query and the geofences table is immutable during this call.
	currentGeofences, err := s.geoRepo.FindContaining(ctx, req.Latitude, req.Longitude)
	if err != nil {
		return nil, fmt.Errorf("spatial query: %w", err)
	}

	// Build a map for O(1) set operations.
	currentSet := make(map[string]models.GeofenceRef, len(currentGeofences))
	for _, g := range currentGeofences {
		currentSet[g.ID] = g
	}

	// ── 3. Begin transaction ─────────────────────────────────────────────────
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	// ── 4. Load previous location (FOR UPDATE to serialize concurrent calls) ─
	prevLoc, err := s.locRepo.GetCurrentLocationTx(ctx, tx, req.VehicleID)
	if err != nil {
		return nil, fmt.Errorf("load previous location: %w", err)
	}

	// ── 5. Out-of-order rejection ─────────────────────────────────────────────
	// Business rule: reject any update with a timestamp ≤ the last accepted
	// timestamp.  This prevents GPS replay and concurrent duplicate events.
	if prevLoc != nil && !req.Timestamp.After(prevLoc.Timestamp) {
		_ = tx.Rollback(ctx)
		return nil, ErrOutOfOrderTimestamp
	}

	// ── 6. Load previous geofence state ──────────────────────────────────────
	prevStateIDs, err := s.locRepo.GetGeofenceStateTx(ctx, tx, req.VehicleID)
	if err != nil {
		return nil, fmt.Errorf("load geofence state: %w", err)
	}

	isFirstUpdate := prevLoc == nil

	// ── 7. Compute entered and exited sets ────────────────────────────────────
	// entered = current - previous
	// exited  = previous - current
	var enteredZones, exitedZones []models.GeofenceRef

	if !isFirstUpdate {
		for id, ref := range currentSet {
			if _, wasPrev := prevStateIDs[id]; !wasPrev {
				enteredZones = append(enteredZones, ref)
			}
		}
		for id := range prevStateIDs {
			if _, isCurrent := currentSet[id]; !isCurrent {
				// We need the full GeofenceRef for exited zones; look it up.
				ref, err := s.getGeofenceRef(ctx, id)
				if err != nil {
					return nil, err
				}
				if ref != nil {
					exitedZones = append(exitedZones, *ref)
				}
			}
		}
	}
	// On first update we just initialize state — no events generated.

	// ── 8. Persist location ───────────────────────────────────────────────────
	if err = s.locRepo.UpsertLocationTx(ctx, tx, req.VehicleID, req.Latitude, req.Longitude, req.Timestamp); err != nil {
		return nil, fmt.Errorf("upsert location: %w", err)
	}

	// ── 9. Persist new geofence state ─────────────────────────────────────────
	newIDs := make([]string, 0, len(currentSet))
	for id := range currentSet {
		newIDs = append(newIDs, id)
	}
	if err = s.locRepo.ReplaceGeofenceStateTx(ctx, tx, req.VehicleID, newIDs); err != nil {
		return nil, fmt.Errorf("replace geofence state: %w", err)
	}

	// ── 10. Persist violations and evaluate alerts ────────────────────────────
	var events []models.LocationEvent

	processZones := func(zones []models.GeofenceRef, eventType string) error {
		for _, zone := range zones {
			// Default restricted-zone alert: always alert, regardless of rules.
			isRestricted := zone.Category == models.CategoryRestrictedZone && eventType == "enter"

			// Look up configured alert rules.
			matchingRules, err := s.alertRepo.FindMatchingTx(ctx, tx, req.VehicleID, zone.ID, eventType)
			if err != nil {
				return fmt.Errorf("find alert rules: %w", err)
			}

			alertSent := isRestricted || len(matchingRules) > 0

			// Persist the violation record.
			_, err = s.violRepo.InsertTx(ctx, tx, req.VehicleID, zone.ID, eventType, req.Timestamp, alertSent)
			if err != nil {
				return fmt.Errorf("insert violation: %w", err)
			}

			events = append(events, models.LocationEvent{
				GeofenceID:   zone.ID,
				GeofenceName: zone.Name,
				Category:     zone.Category,
				EventType:    eventType,
				AlertSent:    alertSent,
			})

			// Queue alerts — non-blocking so we don't hold the transaction open
			// for WebSocket delivery.
			if alertSent {
				s.queueAlert(vehicle, zone, eventType, req.Timestamp)
			}
		}
		return nil
	}

	if err = processZones(enteredZones, "enter"); err != nil {
		return nil, err
	}
	if err = processZones(exitedZones, "exit"); err != nil {
		return nil, err
	}

	// ── 11. Commit ────────────────────────────────────────────────────────────
	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	log.Info().
		Str("vehicle_id", req.VehicleID).
		Float64("lat", req.Latitude).
		Float64("lon", req.Longitude).
		Int("current_zones", len(currentGeofences)).
		Int("entered", len(enteredZones)).
		Int("exited", len(exitedZones)).
		Bool("first_update", isFirstUpdate).
		Msg("location updated")

	if currentGeofences == nil {
		currentGeofences = []models.GeofenceRef{}
	}
	if events == nil {
		events = []models.LocationEvent{}
	}

	return &models.UpdateLocationResponse{
		Location: models.VehicleLocation{
			VehicleID: req.VehicleID,
			Latitude:  req.Latitude,
			Longitude: req.Longitude,
			Timestamp: req.Timestamp,
			UpdatedAt: time.Now(),
		},
		InsideGeofences: currentGeofences,
		Events:          events,
	}, nil
}

// GetCurrentLocation returns a vehicle's latest position and geofence
// membership.
func (s *LocationService) GetCurrentLocation(ctx context.Context, vehicleID string) (*models.CurrentLocationResponse, error) {
	vehicle, err := s.vehicleRepo.GetByID(ctx, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("lookup vehicle: %w", err)
	}
	if vehicle == nil {
		return nil, ErrVehicleNotFound
	}

	loc, err := s.locRepo.GetCurrentLocation(ctx, vehicleID)
	if err != nil {
		return nil, err
	}

	insideGeofences, err := s.locRepo.GetInsideGeofences(ctx, vehicleID)
	if err != nil {
		return nil, err
	}

	return &models.CurrentLocationResponse{
		Vehicle:         *vehicle,
		Location:        loc,
		InsideGeofences: insideGeofences,
	}, nil
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// getGeofenceRef fetches a lightweight GeofenceRef for the given ID.
// Used when building exited zone details.
func (s *LocationService) getGeofenceRef(ctx context.Context, geofenceID string) (*models.GeofenceRef, error) {
	g, err := s.geoRepo.GetByID(ctx, geofenceID)
	if err != nil {
		return nil, fmt.Errorf("get geofence ref: %w", err)
	}
	if g == nil {
		return nil, nil
	}
	return &models.GeofenceRef{ID: g.ID, Name: g.Name, Category: g.Category}, nil
}

// queueAlert creates and broadcasts a WebSocket alert message.
// Called after the transaction commits — the hub send is non-blocking.
func (s *LocationService) queueAlert(vehicle *models.Vehicle, zone models.GeofenceRef, eventType string, ts time.Time) {
	eventLabel := "geofence_entry"
	verb := "entered"
	if eventType == "exit" {
		eventLabel = "geofence_exit"
		verb = "exited"
	}

	alert := models.WSAlert{
		Event:         eventLabel,
		VehicleID:     vehicle.ID,
		VehicleNumber: vehicle.VehicleNumber,
		GeofenceID:    zone.ID,
		GeofenceName:  zone.Name,
		EventType:     eventType,
		Timestamp:     ts,
		Message:       fmt.Sprintf("Vehicle %s %s %s", vehicle.VehicleNumber, verb, zone.Name),
	}

	s.hub.Broadcast(alert)
}

// ─── Sentinel errors ─────────────────────────────────────────────────────────

var (
	ErrVehicleNotFound    = fmt.Errorf("vehicle not found")
	ErrOutOfOrderTimestamp = fmt.Errorf("location timestamp is out of order")
)

package repositories

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mapup/vehicle-tracking/internal/models"
)

// LocationRepository handles vehicle_locations and vehicle_geofence_state.
type LocationRepository struct {
	pool *pgxpool.Pool
}

// NewLocationRepository creates a new LocationRepository.
func NewLocationRepository(pool *pgxpool.Pool) *LocationRepository {
	return &LocationRepository{pool: pool}
}

// GetCurrentLocation returns the latest location for a vehicle, or nil if none.
func (r *LocationRepository) GetCurrentLocation(ctx context.Context, vehicleID string) (*models.VehicleLocation, error) {
	var loc models.VehicleLocation
	err := r.pool.QueryRow(ctx, `
		SELECT vehicle_id, latitude, longitude, timestamp, updated_at
		FROM vehicle_locations
		WHERE vehicle_id = $1
	`, vehicleID).Scan(&loc.VehicleID, &loc.Latitude, &loc.Longitude, &loc.Timestamp, &loc.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get current location: %w", err)
	}
	return &loc, nil
}

// GetCurrentLocationTx returns the latest location within a transaction.
// Uses SELECT FOR UPDATE to serialize concurrent updates for the same vehicle.
func (r *LocationRepository) GetCurrentLocationTx(ctx context.Context, tx pgx.Tx, vehicleID string) (*models.VehicleLocation, error) {
	var loc models.VehicleLocation
	err := tx.QueryRow(ctx, `
		SELECT vehicle_id, latitude, longitude, timestamp, updated_at
		FROM vehicle_locations
		WHERE vehicle_id = $1
		FOR UPDATE
	`, vehicleID).Scan(&loc.VehicleID, &loc.Latitude, &loc.Longitude, &loc.Timestamp, &loc.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get current location for update: %w", err)
	}
	return &loc, nil
}

// UpsertLocationTx upserts the vehicle's latest position within a transaction.
func (r *LocationRepository) UpsertLocationTx(ctx context.Context, tx pgx.Tx, vehicleID string, lat, lon float64, ts time.Time) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, timestamp, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (vehicle_id)
		DO UPDATE SET
			latitude   = EXCLUDED.latitude,
			longitude  = EXCLUDED.longitude,
			timestamp  = EXCLUDED.timestamp,
			updated_at = NOW()
	`, vehicleID, lat, lon, ts)
	if err != nil {
		return fmt.Errorf("upsert location: %w", err)
	}
	return nil
}

// GetGeofenceStateTx returns the set of geofence IDs a vehicle is currently
// inside, within a transaction.
func (r *LocationRepository) GetGeofenceStateTx(ctx context.Context, tx pgx.Tx, vehicleID string) (map[string]struct{}, error) {
	rows, err := tx.Query(ctx, `
		SELECT geofence_id FROM vehicle_geofence_state WHERE vehicle_id = $1
	`, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("get geofence state: %w", err)
	}
	defer rows.Close()

	state := make(map[string]struct{})
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		state[id] = struct{}{}
	}
	return state, rows.Err()
}

// ReplaceGeofenceStateTx atomically replaces the entire geofence state for a
// vehicle within a transaction.  It deletes all current memberships and
// inserts the new set in one round-trip.
func (r *LocationRepository) ReplaceGeofenceStateTx(ctx context.Context, tx pgx.Tx, vehicleID string, geofenceIDs []string) error {
	// Delete all existing memberships for this vehicle.
	if _, err := tx.Exec(ctx, `
		DELETE FROM vehicle_geofence_state WHERE vehicle_id = $1
	`, vehicleID); err != nil {
		return fmt.Errorf("delete geofence state: %w", err)
	}

	if len(geofenceIDs) == 0 {
		return nil
	}

	// Batch insert the new memberships.
	rows := make([][]any, len(geofenceIDs))
	for i, gid := range geofenceIDs {
		rows[i] = []any{vehicleID, gid}
	}

	_, err := tx.CopyFrom(ctx,
		pgx.Identifier{"vehicle_geofence_state"},
		[]string{"vehicle_id", "geofence_id"},
		pgx.CopyFromRows(rows),
	)
	if err != nil {
		return fmt.Errorf("insert geofence state: %w", err)
	}
	return nil
}

// GetInsideGeofences returns geofence details for a vehicle's current state.
func (r *LocationRepository) GetInsideGeofences(ctx context.Context, vehicleID string) ([]models.GeofenceRef, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT g.id, g.name, g.category
		FROM vehicle_geofence_state vgs
		JOIN geofences g ON g.id = vgs.geofence_id
		WHERE vgs.vehicle_id = $1
	`, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("get inside geofences: %w", err)
	}
	defer rows.Close()

	var refs []models.GeofenceRef
	for rows.Next() {
		var ref models.GeofenceRef
		if err := rows.Scan(&ref.ID, &ref.Name, &ref.Category); err != nil {
			return nil, err
		}
		refs = append(refs, ref)
	}
	return refs, rows.Err()
}

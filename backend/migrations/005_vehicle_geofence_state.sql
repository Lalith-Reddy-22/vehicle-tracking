-- vehicle_geofence_state represents the set of geofences a vehicle is
-- currently inside.  One row per (vehicle, geofence) pair.
--
-- The unique constraint ensures we never double-insert an active membership.
-- The service layer reads this table to compute previous_zones, then replaces
-- the entire set within the same transaction as the location update.

CREATE TABLE IF NOT EXISTS vehicle_geofence_state (
    vehicle_id      UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_id     UUID        NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    entered_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (vehicle_id, geofence_id)
);

CREATE INDEX IF NOT EXISTS idx_vgs_vehicle_id
    ON vehicle_geofence_state (vehicle_id);

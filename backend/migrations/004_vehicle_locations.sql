-- vehicle_locations stores the latest accepted GPS position for every vehicle.
-- We keep one row per vehicle (upsert), not a full track history, because the
-- primary query is "where is this vehicle now?".  Full history lives in
-- violations + raw location could be archived in a separate time-series table.

CREATE TABLE IF NOT EXISTS vehicle_locations (
    vehicle_id      UUID        PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    -- timestamp is the GPS timestamp from the client, not the server receipt time.
    -- Out-of-order detection compares new_timestamp > existing timestamp.
    timestamp       TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_locations_vehicle_id
    ON vehicle_locations (vehicle_id);

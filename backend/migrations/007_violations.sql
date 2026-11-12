-- violations records every entry and exit event permanently.
-- alert_triggered indicates whether a matching alert rule fired for this event.
-- This table grows indefinitely — in a production system you would partition it
-- by timestamp (monthly or weekly) using PostgreSQL declarative partitioning.

CREATE TABLE IF NOT EXISTS violations (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id      UUID        NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_id     UUID        NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    event_type      TEXT        NOT NULL CHECK (event_type IN ('enter', 'exit')),
    timestamp       TIMESTAMPTZ NOT NULL,
    alert_triggered BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite indexes optimized for the two most common violation-history queries:
--   1. All violations for a vehicle, ordered by time.
--   2. All violations for a geofence, ordered by time.
CREATE INDEX IF NOT EXISTS idx_violations_vehicle_timestamp
    ON violations (vehicle_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_violations_geofence_timestamp
    ON violations (geofence_id, timestamp DESC);

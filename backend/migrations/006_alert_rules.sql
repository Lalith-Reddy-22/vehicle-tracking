-- alert_rules define when a WebSocket alert should be broadcast.
-- vehicle_id NULL means the rule applies to ALL vehicles.
-- event_type 'both' means the rule fires on enter AND exit.

CREATE TABLE IF NOT EXISTS alert_rules (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id  UUID        REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_id UUID        NOT NULL REFERENCES geofences(id) ON DELETE CASCADE,
    event_type  TEXT        NOT NULL
                            CHECK (event_type IN ('enter', 'exit', 'both')),
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_geofence_id
    ON alert_rules (geofence_id);

CREATE INDEX IF NOT EXISTS idx_alert_rules_vehicle_id
    ON alert_rules (vehicle_id);

-- Vehicles table.
-- vehicle_number has a unique index — the application returns HTTP 409 on
-- a duplicate insert attempt.

CREATE TABLE IF NOT EXISTS vehicles (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_number  TEXT        NOT NULL,
    driver_name     TEXT        NOT NULL,
    vehicle_type    TEXT        NOT NULL,
    phone           TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_vehicle_number
    ON vehicles (vehicle_number);

-- Add name column to alert_rules and make geofence_id optional.
-- A rule with geofence_id NULL applies to ALL geofences.

ALTER TABLE alert_rules
    ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';

ALTER TABLE alert_rules
    ALTER COLUMN geofence_id DROP NOT NULL;

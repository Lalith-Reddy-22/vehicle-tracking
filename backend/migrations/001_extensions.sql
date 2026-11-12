-- Enable the PostGIS extension. Must be done before any geometry columns.
-- PostGIS provides ST_Covers, ST_MakePoint, ST_SetSRID, and the geometry type.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

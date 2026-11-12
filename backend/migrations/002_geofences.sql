-- Geofences table.
-- The 'geom' column stores the polygon in SRID 4326 (WGS84 lat/lon degrees),
-- which is the same CRS used by GPS hardware and GeoJSON.
-- We store coordinates in [lon, lat] order inside PostGIS (GeoJSON convention).
-- The API layer converts incoming [lat, lon] pairs before writing.

CREATE TABLE IF NOT EXISTS geofences (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT        NOT NULL,
    category    TEXT        NOT NULL
                            CHECK (category IN (
                                'delivery_zone',
                                'restricted_zone',
                                'toll_zone',
                                'customer_area'
                            )),
    geom        GEOMETRY(Polygon, 4326) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GIST spatial index — this is what makes ST_Covers fast on large datasets.
-- PostGIS uses an R-tree variant inside GIST for bounding-box pre-filtering
-- before the exact predicate is evaluated.
CREATE INDEX IF NOT EXISTS idx_geofences_geom
    ON geofences USING GIST (geom);

-- B-tree index for fast category filtering.
CREATE INDEX IF NOT EXISTS idx_geofences_category
    ON geofences (category);

// Package repositories contains all PostgreSQL data access logic.
// Each repository receives a *pgxpool.Pool and executes parameterized SQL.
// No ORM is used — raw pgx gives us full control over query planning.
package repositories

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mapup/vehicle-tracking/internal/geospatial"
	"github.com/mapup/vehicle-tracking/internal/models"
)

// GeofenceRepository handles all geofence-related database operations.
type GeofenceRepository struct {
	pool *pgxpool.Pool
}

// NewGeofenceRepository creates a new GeofenceRepository.
func NewGeofenceRepository(pool *pgxpool.Pool) *GeofenceRepository {
	return &GeofenceRepository{pool: pool}
}

// Create inserts a new geofence and returns the created record.
// coords is in API format [[lat, lon]] — converted to WKT (lon lat) here.
func (r *GeofenceRepository) Create(ctx context.Context, name string, category models.GeofenceCategory, coords [][]float64) (*models.Geofence, error) {
	wkt := geospatial.APIRingToWKT(coords)

	var g models.Geofence
	err := r.pool.QueryRow(ctx, `
		INSERT INTO geofences (name, category, geom)
		VALUES ($1, $2, ST_GeomFromText($3, 4326))
		RETURNING id, name, category, created_at, updated_at
	`, name, string(category), wkt).Scan(
		&g.ID, &g.Name, &g.Category, &g.CreatedAt, &g.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert geofence: %w", err)
	}

	// Store the original API-order coordinates on the returned model.
	g.Coordinates = apiCoordsToModel(coords)
	return &g, nil
}

// List returns all geofences, optionally filtered by category.
// Coordinates are returned in API [lat, lon] order via ST_AsGeoJSON.
func (r *GeofenceRepository) List(ctx context.Context, category string) ([]models.Geofence, error) {
	query := `
		SELECT id, name, category,
		       (ST_AsGeoJSON(geom)::json -> 'coordinates' -> 0)::text AS ring,
		       created_at, updated_at
		FROM geofences
	`
	args := []any{}
	if category != "" {
		query += " WHERE category = $1"
		args = append(args, category)
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list geofences: %w", err)
	}
	defer rows.Close()

	return scanGeofenceRows(rows)
}

// GetByID returns a single geofence by its UUID.
func (r *GeofenceRepository) GetByID(ctx context.Context, id string) (*models.Geofence, error) {
	var g models.Geofence
	var ringJSON string

	err := r.pool.QueryRow(ctx, `
		SELECT id, name, category,
		       (ST_AsGeoJSON(geom)::json -> 'coordinates' -> 0)::text AS ring,
		       created_at, updated_at
		FROM geofences
		WHERE id = $1
	`, id).Scan(&g.ID, &g.Name, &g.Category, &ringJSON, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get geofence: %w", err)
	}

	coords, err := parseGeoJSONRing([]byte(ringJSON))
	if err != nil {
		return nil, err
	}
	g.Coordinates = coords
	return &g, nil
}

// Update patches a geofence's name and/or category.
// Coordinates are immutable after creation (would change violation history meaning).
func (r *GeofenceRepository) Update(ctx context.Context, id, name string, category models.GeofenceCategory) (*models.Geofence, error) {
	var ringJSON string
	var g models.Geofence
	err := r.pool.QueryRow(ctx, `
		UPDATE geofences
		SET name       = COALESCE(NULLIF($2, ''), name),
		    category   = CASE WHEN $3 = '' THEN category ELSE $3::text END,
		    updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, category,
		          (ST_AsGeoJSON(geom)::json -> 'coordinates' -> 0)::text,
		          created_at, updated_at
	`, id, name, string(category)).
		Scan(&g.ID, &g.Name, &g.Category, &ringJSON, &g.CreatedAt, &g.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("update geofence: %w", err)
	}
	coords, err := parseGeoJSONRing([]byte(ringJSON))
	if err != nil {
		return nil, err
	}
	g.Coordinates = coords
	return &g, nil
}

// Delete removes a geofence by ID. Returns false when not found.
func (r *GeofenceRepository) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM geofences WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete geofence: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}
// Uses ST_Covers (not ST_Contains) so boundary points are treated as inside.
// ST_MakePoint expects (longitude, latitude) — the geospatial package owns
// this conversion; here we pass the already-converted lon first.
func (r *GeofenceRepository) FindContaining(ctx context.Context, lat, lon float64) ([]models.GeofenceRef, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, category
		FROM geofences
		WHERE ST_Covers(
			geom,
			ST_SetSRID(ST_MakePoint($1, $2), 4326)
		)
	`, lon, lat) // $1 = longitude, $2 = latitude (PostGIS convention)
	if err != nil {
		return nil, fmt.Errorf("spatial query FindContaining: %w", err)
	}
	defer rows.Close()

	var refs []models.GeofenceRef
	for rows.Next() {
		var ref models.GeofenceRef
		if err := rows.Scan(&ref.ID, &ref.Name, &ref.Category); err != nil {
			return nil, fmt.Errorf("scan geofence ref: %w", err)
		}
		refs = append(refs, ref)
	}
	return refs, rows.Err()
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func scanGeofenceRows(rows pgx.Rows) ([]models.Geofence, error) {
	var geofences []models.Geofence
	for rows.Next() {
		var g models.Geofence
		var ringJSON string
		if err := rows.Scan(&g.ID, &g.Name, &g.Category, &ringJSON, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan geofence: %w", err)
		}
		coords, err := parseGeoJSONRing([]byte(ringJSON))
		if err != nil {
			return nil, err
		}
		g.Coordinates = coords
		geofences = append(geofences, g)
	}
	return geofences, rows.Err()
}

// parseGeoJSONRing converts a GeoJSON coordinate ring JSON (array of [lon,lat]
// pairs) into API-ordered Coordinate structs.
func parseGeoJSONRing(ringJSON []byte) ([]models.Coordinate, error) {
	if len(ringJSON) == 0 {
		return nil, nil
	}

	// GeoJSON ring: [[lon, lat], [lon, lat], ...]
	var rawCoords [][]float64
	if err := json.Unmarshal(ringJSON, &rawCoords); err != nil {
		return nil, fmt.Errorf("parse geojson ring: %w", err)
	}

	out := make([]models.Coordinate, len(rawCoords))
	for i, c := range rawCoords {
		if len(c) < 2 {
			continue
		}
		// GeoJSON: c[0]=lon, c[1]=lat → API: lat, lon
		out[i] = models.Coordinate{Lat: c[1], Lon: c[0]}
	}
	return out, nil
}

// apiCoordsToModel converts [[lat, lon]] slices to []models.Coordinate.
func apiCoordsToModel(coords [][]float64) []models.Coordinate {
	out := make([]models.Coordinate, len(coords))
	for i, c := range coords {
		if len(c) >= 2 {
			out[i] = models.Coordinate{Lat: c[0], Lon: c[1]}
		}
	}
	return out
}

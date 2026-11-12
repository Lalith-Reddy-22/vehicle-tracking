// Package tests contains unit and integration tests.
// The geospatial tests cover coordinate conversion and polygon validation —
// the most logic-dense parts of the application that run purely in Go
// (no database needed).
package tests

import (
	"testing"

	"github.com/mapup/vehicle-tracking/internal/geospatial"
)

// ─── Coordinate Conversion ───────────────────────────────────────────────────

func TestAPIToPostGIS(t *testing.T) {
	t.Parallel()
	result := geospatial.APIToPostGIS(12.9716, 77.5946)
	if result.Lon != 77.5946 || result.Lat != 12.9716 {
		t.Errorf("APIToPostGIS: got lon=%v lat=%v, want lon=77.5946 lat=12.9716", result.Lon, result.Lat)
	}
}

func TestPostGISToAPI(t *testing.T) {
	t.Parallel()
	result := geospatial.PostGISToAPI(77.5946, 12.9716)
	if result.Lat != 12.9716 || result.Lon != 77.5946 {
		t.Errorf("PostGISToAPI: got lat=%v lon=%v, want lat=12.9716 lon=77.5946", result.Lat, result.Lon)
	}
}

func TestAPIToPostGIS_RoundTrip(t *testing.T) {
	t.Parallel()
	lat, lon := 28.6139, 77.2090 // New Delhi
	pg := geospatial.APIToPostGIS(lat, lon)
	back := geospatial.PostGISToAPI(pg.Lon, pg.Lat)
	if back.Lat != lat || back.Lon != lon {
		t.Errorf("round-trip mismatch: got %v %v, want %v %v", back.Lat, back.Lon, lat, lon)
	}
}

func TestAPIRingToWKT(t *testing.T) {
	t.Parallel()
	coords := [][]float64{
		{12.97, 77.59},
		{12.98, 77.59},
		{12.98, 77.60},
		{12.97, 77.59},
	}
	wkt := geospatial.APIRingToWKT(coords)
	// WKT must start with POLYGON and use lon-lat order internally
	expected := "POLYGON((77.59 12.97,77.59 12.98,77.6 12.98,77.59 12.97))"
	if wkt != expected {
		t.Errorf("WKT mismatch:\n got  %s\n want %s", wkt, expected)
	}
}

// ─── Coordinate Validation ───────────────────────────────────────────────────

func TestValidateCoordinates_Valid(t *testing.T) {
	t.Parallel()
	if err := geospatial.ValidateCoordinates(12.9716, 77.5946); err != nil {
		t.Errorf("unexpected error for valid coords: %v", err)
	}
}

func TestValidateCoordinates_LatOutOfRange(t *testing.T) {
	t.Parallel()
	if err := geospatial.ValidateCoordinates(91.0, 77.5946); err == nil {
		t.Error("expected error for lat=91, got nil")
	}
}

func TestValidateCoordinates_LonOutOfRange(t *testing.T) {
	t.Parallel()
	if err := geospatial.ValidateCoordinates(12.97, 181.0); err == nil {
		t.Error("expected error for lon=181, got nil")
	}
}

func TestValidateCoordinates_NegativeLat(t *testing.T) {
	t.Parallel()
	// -34.6 is a valid lat (Buenos Aires)
	if err := geospatial.ValidateCoordinates(-34.6, -58.4); err != nil {
		t.Errorf("unexpected error for valid negative lat: %v", err)
	}
}

func TestValidateCoordinates_BoundaryValues(t *testing.T) {
	t.Parallel()
	tests := []struct {
		lat, lon float64
		wantErr  bool
	}{
		{90, 180, false},
		{-90, -180, false},
		{0, 0, false},
		{90.001, 0, true},
		{0, -180.001, true},
	}
	for _, tc := range tests {
		err := geospatial.ValidateCoordinates(tc.lat, tc.lon)
		if (err != nil) != tc.wantErr {
			t.Errorf("ValidateCoordinates(%v, %v): got err=%v, wantErr=%v", tc.lat, tc.lon, err, tc.wantErr)
		}
	}
}

// ─── Polygon Validation ──────────────────────────────────────────────────────

// A valid closed square polygon.
var validSquare = [][]float64{
	{12.97, 77.59},
	{12.98, 77.59},
	{12.98, 77.60},
	{12.97, 77.60},
	{12.97, 77.59}, // closes the ring
}

func TestValidatePolygon_Valid(t *testing.T) {
	t.Parallel()
	if err := geospatial.ValidatePolygonCoords(validSquare); err != nil {
		t.Errorf("unexpected error for valid polygon: %v", err)
	}
}

func TestValidatePolygon_TooFewPoints(t *testing.T) {
	t.Parallel()
	coords := [][]float64{
		{12.97, 77.59},
		{12.98, 77.59},
		{12.97, 77.59},
	}
	if err := geospatial.ValidatePolygonCoords(coords); err == nil {
		t.Error("expected error for 3-point polygon, got nil")
	}
}

func TestValidatePolygon_NotClosed(t *testing.T) {
	t.Parallel()
	coords := [][]float64{
		{12.97, 77.59},
		{12.98, 77.59},
		{12.98, 77.60},
		{12.97, 77.61}, // last != first
	}
	if err := geospatial.ValidatePolygonCoords(coords); err == nil {
		t.Error("expected error for unclosed polygon, got nil")
	}
}

func TestValidatePolygon_InvalidLatInRing(t *testing.T) {
	t.Parallel()
	coords := [][]float64{
		{12.97, 77.59},
		{91.00, 77.59}, // invalid lat
		{12.98, 77.60},
		{12.97, 77.59},
	}
	if err := geospatial.ValidatePolygonCoords(coords); err == nil {
		t.Error("expected error for out-of-range lat in ring, got nil")
	}
}

func TestValidatePolygon_Degenerate(t *testing.T) {
	t.Parallel()
	// All points collinear — zero area.
	coords := [][]float64{
		{12.97, 77.59},
		{12.97, 77.60},
		{12.97, 77.61},
		{12.97, 77.59}, // closes
	}
	if err := geospatial.ValidatePolygonCoords(coords); err == nil {
		t.Error("expected error for degenerate (collinear) polygon, got nil")
	}
}

func TestValidatePolygon_ExactlyFourPoints(t *testing.T) {
	t.Parallel()
	// Minimum valid: 3 unique + 1 closing = 4 coordinates.
	coords := [][]float64{
		{12.97, 77.59},
		{12.98, 77.59},
		{12.98, 77.60},
		{12.97, 77.59}, // closes
	}
	if err := geospatial.ValidatePolygonCoords(coords); err != nil {
		t.Errorf("unexpected error for minimum valid polygon: %v", err)
	}
}

// ─── GeoJSON Coordinate Conversion ──────────────────────────────────────────

func TestGeoJSONToAPICoords(t *testing.T) {
	t.Parallel()
	// GeoJSON: [lon, lat]
	geoJSON := [][]float64{{77.59, 12.97}, {77.60, 12.98}}
	api := geospatial.GeoJSONToAPICoords(geoJSON)
	if api[0][0] != 12.97 || api[0][1] != 77.59 {
		t.Errorf("GeoJSONToAPICoords: got [%v %v], want [12.97 77.59]", api[0][0], api[0][1])
	}
}

func TestAPIToGeoJSONCoords(t *testing.T) {
	t.Parallel()
	// API: [lat, lon]
	apiCoords := [][]float64{{12.97, 77.59}, {12.98, 77.60}}
	gj := geospatial.APIToGeoJSONCoords(apiCoords)
	if gj[0][0] != 77.59 || gj[0][1] != 12.97 {
		t.Errorf("APIToGeoJSONCoords: got [%v %v], want [77.59 12.97]", gj[0][0], gj[0][1])
	}
}

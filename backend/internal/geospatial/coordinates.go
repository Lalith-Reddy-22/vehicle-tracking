// Package geospatial is the single source of truth for coordinate ordering.
//
// Coordinate ordering summary
// ───────────────────────────
//   API (external)  : [latitude, longitude]  — matches Leaflet LatLng convention
//   GeoJSON         : [longitude, latitude]  — RFC 7946 §3.1.1
//   PostGIS         : [longitude, latitude]  — ST_MakePoint(lon, lat)
//   Leaflet map     : LatLng(lat, lon)        — same as API
//
// All conversions between these orderings happen here.
// No other package is allowed to swap lat/lon directly.
package geospatial

import (
	"fmt"
	"math"
)

// LatLon holds a latitude/longitude pair in the API's external ordering.
type LatLon struct {
	Lat float64
	Lon float64
}

// LonLat holds a longitude/latitude pair in PostGIS/GeoJSON ordering.
type LonLat struct {
	Lon float64
	Lat float64
}

// APIToPostGIS converts a [lat, lon] API pair to [lon, lat] PostGIS ordering.
func APIToPostGIS(lat, lon float64) LonLat {
	return LonLat{Lon: lon, Lat: lat}
}

// PostGISToAPI converts a [lon, lat] PostGIS pair to [lat, lon] API ordering.
func PostGISToAPI(lon, lat float64) LatLon {
	return LatLon{Lat: lat, Lon: lon}
}

// APIRingToWKT converts a ring of [lat, lon] pairs (as received from the API)
// into a WKT POLYGON string with [lon lat] ordering required by PostGIS.
// The ring must already be closed (first == last coordinate).
func APIRingToWKT(coords [][]float64) string {
	if len(coords) == 0 {
		return "POLYGON EMPTY"
	}
	buf := make([]byte, 0, 128)
	buf = append(buf, "POLYGON(("...)
	for i, c := range coords {
		lat, lon := c[0], c[1]
		if i > 0 {
			buf = append(buf, ',')
		}
		buf = fmt.Appendf(buf, "%v %v", lon, lat) // WKT is lon lat
	}
	buf = append(buf, "))"...)
	return string(buf)
}

// WKTRingToAPICoords parses a simple POLYGON WKT and returns coordinates in
// [lat, lon] API ordering.  This is used when reading geometries back from the
// database via ST_AsText.
//
// Note: PostGIS has native GeoJSON output (ST_AsGeoJSON) which is more robust
// for complex geometries.  We use WKT here because it avoids JSON parsing.

// ValidateCoordinates checks that a lat/lon pair is within valid GPS ranges.
func ValidateCoordinates(lat, lon float64) error {
	if math.IsNaN(lat) || math.IsInf(lat, 0) {
		return fmt.Errorf("latitude is not a finite number")
	}
	if math.IsNaN(lon) || math.IsInf(lon, 0) {
		return fmt.Errorf("longitude is not a finite number")
	}
	if lat < -90 || lat > 90 {
		return fmt.Errorf("latitude %v is out of range [-90, 90]", lat)
	}
	if lon < -180 || lon > 180 {
		return fmt.Errorf("longitude %v is out of range [-180, 180]", lon)
	}
	return nil
}

// GeoJSONToAPICoords converts a GeoJSON coordinate ring ([][lon, lat]) to
// API format ([[lat, lon]]).
func GeoJSONToAPICoords(ring [][]float64) [][]float64 {
	out := make([][]float64, len(ring))
	for i, c := range ring {
		if len(c) < 2 {
			continue
		}
		// GeoJSON: c[0]=lon, c[1]=lat → API: [lat, lon]
		out[i] = []float64{c[1], c[0]}
	}
	return out
}

// APIToGeoJSONCoords converts API coordinate ring ([[lat, lon]]) to GeoJSON
// format ([[lon, lat]]).
func APIToGeoJSONCoords(ring [][]float64) [][]float64 {
	out := make([][]float64, len(ring))
	for i, c := range ring {
		if len(c) < 2 {
			continue
		}
		// API: c[0]=lat, c[1]=lon → GeoJSON: [lon, lat]
		out[i] = []float64{c[1], c[0]}
	}
	return out
}

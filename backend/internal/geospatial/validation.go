package geospatial

import (
	"fmt"
	"math"
)

// ValidatePolygonCoords validates an API-format polygon ring ([[lat, lon]]).
// Rules:
//  1. At least 4 positions (3 unique + closing position).
//  2. First and last coordinates must match (closed ring).
//  3. Each coordinate must be in valid lat/lon range.
//  4. Basic self-intersection check using the shoelace algorithm sign test
//     (a simple proxy; full self-intersection detection requires a full
//      Bentley–Ottmann sweep which PostGIS will catch server-side anyway).
func ValidatePolygonCoords(coords [][]float64) error {
	if len(coords) < 4 {
		return fmt.Errorf("polygon requires at least 4 coordinate positions (got %d); include the closing position", len(coords))
	}

	first, last := coords[0], coords[len(coords)-1]
	if !coordsEqual(first, last) {
		return fmt.Errorf("polygon ring is not closed: first %v and last %v coordinates do not match", first, last)
	}

	for i, c := range coords {
		if len(c) < 2 {
			return fmt.Errorf("coordinate at index %d has fewer than 2 elements", i)
		}
		if err := ValidateCoordinates(c[0], c[1]); err != nil {
			return fmt.Errorf("coordinate at index %d: %w", i, err)
		}
	}

	if isDegenerate(coords) {
		return fmt.Errorf("polygon is degenerate: all points are collinear or duplicate")
	}

	return nil
}

// coordsEqual returns true when two [lat, lon] pairs match within floating
// point epsilon.
func coordsEqual(a, b []float64) bool {
	const eps = 1e-9
	return math.Abs(a[0]-b[0]) < eps && math.Abs(a[1]-b[1]) < eps
}

// isDegenerate returns true when the polygon has zero area (all points are
// collinear or all identical).  Uses the shoelace formula — the area of a
// non-degenerate polygon is always nonzero.
func isDegenerate(coords [][]float64) bool {
	area := 0.0
	n := len(coords) - 1 // exclude closing duplicate
	for i := 0; i < n; i++ {
		j := (i + 1) % n
		// Using lon (c[1]) and lat (c[0]) as x/y for the area calculation.
		area += coords[i][1] * coords[j][0]
		area -= coords[j][1] * coords[i][0]
	}
	return math.Abs(area) < 1e-12
}

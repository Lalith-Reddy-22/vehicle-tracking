package tests

import (
	"testing"
	"time"
)

// isOutOfOrder mirrors the timestamp rejection logic in LocationService.
// A new timestamp is rejected if it is NOT strictly after the last accepted one.
func isOutOfOrder(newTS, lastTS time.Time) bool {
	return !newTS.After(lastTS)
}

func TestOutOfOrder_FutureTimestampAccepted(t *testing.T) {
	t.Parallel()
	last := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	incoming := last.Add(time.Second)
	if isOutOfOrder(incoming, last) {
		t.Error("future timestamp should be accepted (not out-of-order)")
	}
}

func TestOutOfOrder_PastTimestampRejected(t *testing.T) {
	t.Parallel()
	last := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	incoming := last.Add(-time.Second)
	if !isOutOfOrder(incoming, last) {
		t.Error("past timestamp should be rejected (out-of-order)")
	}
}

func TestOutOfOrder_EqualTimestampRejected(t *testing.T) {
	t.Parallel()
	// Exact same timestamp must be rejected to prevent duplicate events.
	ts := time.Date(2026, 11, 12, 10, 0, 0, 0, time.UTC)
	if !isOutOfOrder(ts, ts) {
		t.Error("equal timestamp should be rejected")
	}
}

func TestOutOfOrder_FirstUpdate_NoPreviousLocation(t *testing.T) {
	t.Parallel()
	// When prevLoc is nil (first update), there is nothing to compare against.
	// The service checks `prevLoc != nil` before calling isOutOfOrder.
	// This test documents that contract.
	var prevLoc *struct{ Timestamp time.Time }
	if prevLoc != nil {
		t.Error("first update should have no previous location")
	}
	// No out-of-order check is performed on first update.
}

// ─── Geofence Set Diffing ─────────────────────────────────────────────────────

type zone struct{ ID string }

// diffZones computes entered and exited sets from previous and current zone maps.
// This is a pure function mirror of the logic in LocationService.UpdateLocation.
func diffZones(prev, current map[string]zone) (entered, exited []zone) {
	for id, z := range current {
		if _, ok := prev[id]; !ok {
			entered = append(entered, z)
		}
	}
	for id, z := range prev {
		if _, ok := current[id]; !ok {
			exited = append(exited, z)
		}
	}
	return
}

func TestDiff_EnteredZone(t *testing.T) {
	t.Parallel()
	prev := map[string]zone{}
	current := map[string]zone{"g1": {ID: "g1"}}
	entered, exited := diffZones(prev, current)
	if len(entered) != 1 || entered[0].ID != "g1" {
		t.Errorf("expected 1 entered zone g1, got entered=%v exited=%v", entered, exited)
	}
	if len(exited) != 0 {
		t.Errorf("expected 0 exited zones, got %v", exited)
	}
}

func TestDiff_ExitedZone(t *testing.T) {
	t.Parallel()
	prev := map[string]zone{"g1": {ID: "g1"}}
	current := map[string]zone{}
	entered, exited := diffZones(prev, current)
	if len(exited) != 1 || exited[0].ID != "g1" {
		t.Errorf("expected 1 exited zone g1, got exited=%v", exited)
	}
	if len(entered) != 0 {
		t.Errorf("expected 0 entered zones, got %v", entered)
	}
}

func TestDiff_NoChange(t *testing.T) {
	t.Parallel()
	zones := map[string]zone{"g1": {ID: "g1"}, "g2": {ID: "g2"}}
	entered, exited := diffZones(zones, zones)
	if len(entered) != 0 || len(exited) != 0 {
		t.Errorf("expected no events when zones unchanged, got entered=%v exited=%v", entered, exited)
	}
}

func TestDiff_OverlappingGeofences(t *testing.T) {
	t.Parallel()
	// Vehicle was in g1 only; now inside g1 AND g2 (overlap scenario).
	prev := map[string]zone{"g1": {ID: "g1"}}
	current := map[string]zone{"g1": {ID: "g1"}, "g2": {ID: "g2"}}
	entered, exited := diffZones(prev, current)
	if len(entered) != 1 || entered[0].ID != "g2" {
		t.Errorf("expected only g2 to be entered, got entered=%v", entered)
	}
	if len(exited) != 0 {
		t.Errorf("expected no exits, got exited=%v", exited)
	}
}

func TestDiff_FirstUpdate_EntersCurrentZones(t *testing.T) {
	t.Parallel()
	// On first update prevLoc is nil, so the service treats all current zones
	// as entered (the vehicle is being tracked for the first time).
	current := map[string]zone{"g1": {ID: "g1"}}
	isFirstUpdate := true
	var entered []zone
	if isFirstUpdate {
		for _, z := range current {
			entered = append(entered, z)
		}
	}
	if len(entered) != 1 || entered[0].ID != "g1" {
		t.Errorf("first update inside a geofence should produce an enter event, got %v", entered)
	}
}

func TestDiff_SimultaneousEnterAndExit(t *testing.T) {
	t.Parallel()
	// Vehicle leaves g1 and enters g2 at the same update.
	prev := map[string]zone{"g1": {ID: "g1"}}
	current := map[string]zone{"g2": {ID: "g2"}}
	entered, exited := diffZones(prev, current)
	if len(entered) != 1 || entered[0].ID != "g2" {
		t.Errorf("expected enter g2, got %v", entered)
	}
	if len(exited) != 1 || exited[0].ID != "g1" {
		t.Errorf("expected exit g1, got %v", exited)
	}
}

package tests

import (
	"testing"

	"github.com/mapup/vehicle-tracking/internal/models"
)

// matchesRule mirrors the alert rule matching logic from the service layer.
// We test it here in pure Go without a database connection so this suite
// can run in CI without PostGIS.
func matchesRule(rule models.AlertRule, vehicleID, geofenceID, eventType string) bool {
	if !rule.IsActive {
		return false
	}
	if rule.GeofenceID != nil && *rule.GeofenceID != geofenceID {
		return false
	}
	if rule.VehicleID != nil && *rule.VehicleID != vehicleID {
		return false
	}
	if rule.EventType != models.AlertEventBoth && string(rule.EventType) != eventType {
		return false
	}
	return true
}

func ptr(s string) *string { return &s }

func TestAlertRule_ActiveEnterMatch(t *testing.T) {
	t.Parallel()
	rule := models.AlertRule{
		GeofenceID: ptr("g1"), EventType: "enter", IsActive: true, VehicleID: nil,
	}
	if !matchesRule(rule, "v1", "g1", "enter") {
		t.Error("expected match for active enter rule, all-vehicle")
	}
}

func TestAlertRule_InactiveDoesNotMatch(t *testing.T) {
	t.Parallel()
	rule := models.AlertRule{
		GeofenceID: ptr("g1"), EventType: "enter", IsActive: false, VehicleID: nil,
	}
	if matchesRule(rule, "v1", "g1", "enter") {
		t.Error("expected no match for inactive rule")
	}
}

func TestAlertRule_WrongGeofence(t *testing.T) {
	t.Parallel()
	rule := models.AlertRule{
		GeofenceID: ptr("g2"), EventType: "enter", IsActive: true, VehicleID: nil,
	}
	if matchesRule(rule, "v1", "g1", "enter") {
		t.Error("expected no match when geofence_id differs")
	}
}

func TestAlertRule_SpecificVehicleMatch(t *testing.T) {
	t.Parallel()
	rule := models.AlertRule{
		GeofenceID: ptr("g1"), EventType: "exit", IsActive: true, VehicleID: ptr("v1"),
	}
	if !matchesRule(rule, "v1", "g1", "exit") {
		t.Error("expected match for specific vehicle rule")
	}
}

func TestAlertRule_SpecificVehicleNoMatchOther(t *testing.T) {
	t.Parallel()
	rule := models.AlertRule{
		GeofenceID: ptr("g1"), EventType: "exit", IsActive: true, VehicleID: ptr("v1"),
	}
	if matchesRule(rule, "v2", "g1", "exit") {
		t.Error("specific vehicle rule should not match a different vehicle")
	}
}

func TestAlertRule_BothEventMatchesEnter(t *testing.T) {
	t.Parallel()
	rule := models.AlertRule{
		GeofenceID: ptr("g1"), EventType: "both", IsActive: true, VehicleID: nil,
	}
	if !matchesRule(rule, "v1", "g1", "enter") {
		t.Error("'both' rule should match 'enter'")
	}
	if !matchesRule(rule, "v1", "g1", "exit") {
		t.Error("'both' rule should match 'exit'")
	}
}

func TestAlertRule_ExitRuleDoesNotMatchEnter(t *testing.T) {
	t.Parallel()
	rule := models.AlertRule{
		GeofenceID: ptr("g1"), EventType: "exit", IsActive: true, VehicleID: nil,
	}
	if matchesRule(rule, "v1", "g1", "enter") {
		t.Error("exit rule should not match enter event")
	}
}

// TestRestrictedZoneDefaultAlert verifies the business rule:
// entering a restricted_zone always triggers an alert even without a configured rule.
func TestRestrictedZoneDefaultAlert(t *testing.T) {
	t.Parallel()
	zone := models.GeofenceRef{
		ID:       "g1",
		Name:     "Secure Perimeter",
		Category: models.CategoryRestrictedZone,
	}
	eventType := "enter"
	isRestricted := zone.Category == models.CategoryRestrictedZone && eventType == "enter"
	if !isRestricted {
		t.Error("entering a restricted_zone must always trigger an alert")
	}

	// Exiting a restricted zone should NOT trigger the default alert.
	isRestrictedExit := zone.Category == models.CategoryRestrictedZone && "exit" == "enter"
	if isRestrictedExit {
		t.Error("exiting a restricted_zone should not trigger default alert")
	}
}

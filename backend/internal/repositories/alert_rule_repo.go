package repositories

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mapup/vehicle-tracking/internal/models"
)

// AlertRuleRepository handles alert rule CRUD and matching queries.
type AlertRuleRepository struct {
	pool *pgxpool.Pool
}

// NewAlertRuleRepository creates a new AlertRuleRepository.
func NewAlertRuleRepository(pool *pgxpool.Pool) *AlertRuleRepository {
	return &AlertRuleRepository{pool: pool}
}

// Create inserts a new alert rule.
func (r *AlertRuleRepository) Create(ctx context.Context, req *models.CreateAlertRuleRequest) (*models.AlertRule, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var rule models.AlertRule
	err := r.pool.QueryRow(ctx, `
		INSERT INTO alert_rules (name, vehicle_id, geofence_id, event_type, is_active)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, vehicle_id, geofence_id, event_type, is_active, created_at, updated_at
	`, req.Name, req.VehicleID, req.GeofenceID, string(req.EventType), isActive).
		Scan(&rule.ID, &rule.Name, &rule.VehicleID, &rule.GeofenceID, &rule.EventType,
			&rule.IsActive, &rule.CreatedAt, &rule.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert alert rule: %w", err)
	}
	return &rule, nil
}

// List returns all alert rules.
func (r *AlertRuleRepository) List(ctx context.Context) ([]models.AlertRule, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, name, vehicle_id, geofence_id, event_type, is_active, created_at, updated_at
		FROM alert_rules
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list alert rules: %w", err)
	}
	defer rows.Close()

	return scanAlertRuleRows(rows)
}

// FindMatchingTx returns active alert rules matching a geofence/vehicle/event
// combination, within a transaction.  Called during location update processing.
//
// Matching logic:
//   - rule.is_active = true
//   - rule.geofence_id IS NULL (applies to all) OR rule.geofence_id = geofenceID
//   - rule.vehicle_id IS NULL (applies to all) OR rule.vehicle_id = vehicleID
//   - rule.event_type = eventType OR rule.event_type = 'both'
func (r *AlertRuleRepository) FindMatchingTx(ctx context.Context, tx pgx.Tx, vehicleID, geofenceID, eventType string) ([]models.AlertRule, error) {
	rows, err := tx.Query(ctx, `
		SELECT id, name, vehicle_id, geofence_id, event_type, is_active, created_at, updated_at
		FROM alert_rules
		WHERE is_active = true
		  AND (geofence_id IS NULL OR geofence_id = $1)
		  AND (vehicle_id IS NULL OR vehicle_id = $2)
		  AND (event_type = $3 OR event_type = 'both')
	`, geofenceID, vehicleID, eventType)
	if err != nil {
		return nil, fmt.Errorf("find matching rules: %w", err)
	}
	defer rows.Close()

	return scanAlertRuleRows(rows)
}

func scanAlertRuleRows(rows pgx.Rows) ([]models.AlertRule, error) {
	var rules []models.AlertRule
	for rows.Next() {
		var rule models.AlertRule
		if err := rows.Scan(
			&rule.ID, &rule.Name, &rule.VehicleID, &rule.GeofenceID,
			&rule.EventType, &rule.IsActive, &rule.CreatedAt, &rule.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan alert rule: %w", err)
		}
		rules = append(rules, rule)
	}
	return rules, rows.Err()
}

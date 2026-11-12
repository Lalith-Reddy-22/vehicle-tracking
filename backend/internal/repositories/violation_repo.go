package repositories

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mapup/vehicle-tracking/internal/models"
)

// ViolationRepository handles persisting and querying violation events.
type ViolationRepository struct {
	pool *pgxpool.Pool
}

// NewViolationRepository creates a new ViolationRepository.
func NewViolationRepository(pool *pgxpool.Pool) *ViolationRepository {
	return &ViolationRepository{pool: pool}
}

// InsertTx inserts a violation record within an existing transaction.
func (r *ViolationRepository) InsertTx(ctx context.Context, tx pgx.Tx, vehicleID, geofenceID, eventType string, ts time.Time, alertTriggered bool) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO violations (vehicle_id, geofence_id, event_type, timestamp, alert_triggered)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, vehicleID, geofenceID, eventType, ts, alertTriggered).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("insert violation: %w", err)
	}
	return id, nil
}

// History returns a filtered, paginated slice of violations with a total count.
// The same WHERE clause is used for both the data query and COUNT to ensure
// consistency. This avoids the classic "total vs page mismatch" bug.
func (r *ViolationRepository) History(ctx context.Context, req *models.ViolationHistoryRequest) ([]models.Violation, int64, error) {
	// Build the WHERE clause dynamically but safely (parameterized).
	conditions := []string{"1=1"}
	args := []any{}
	argIdx := 1

	if req.VehicleID != "" {
		conditions = append(conditions, fmt.Sprintf("v.vehicle_id = $%d", argIdx))
		args = append(args, req.VehicleID)
		argIdx++
	}
	if req.GeofenceID != "" {
		conditions = append(conditions, fmt.Sprintf("v.geofence_id = $%d", argIdx))
		args = append(args, req.GeofenceID)
		argIdx++
	}
	if req.EventType != "" {
		conditions = append(conditions, fmt.Sprintf("v.event_type = $%d", argIdx))
		args = append(args, req.EventType)
		argIdx++
	}
	if req.StartTime != nil {
		conditions = append(conditions, fmt.Sprintf("v.timestamp >= $%d", argIdx))
		args = append(args, *req.StartTime)
		argIdx++
	}
	if req.EndTime != nil {
		conditions = append(conditions, fmt.Sprintf("v.timestamp <= $%d", argIdx))
		args = append(args, *req.EndTime)
		argIdx++
	}

	where := strings.Join(conditions, " AND ")

	// Count query — reuses same WHERE clause without LIMIT/OFFSET.
	var total int64
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM violations v
		WHERE %s
	`, where)
	if err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count violations: %w", err)
	}

	// Data query with pagination and joined vehicle/geofence names.
	limitArg := argIdx
	offsetArg := argIdx + 1
	dataQuery := fmt.Sprintf(`
		SELECT
			v.id,
			v.vehicle_id,
			vh.vehicle_number,
			vh.driver_name,
			v.geofence_id,
			g.name  AS geofence_name,
			g.category,
			v.event_type,
			v.timestamp,
			v.alert_triggered,
			v.created_at
		FROM violations v
		JOIN vehicles  vh ON vh.id = v.vehicle_id
		JOIN geofences g  ON g.id  = v.geofence_id
		WHERE %s
		ORDER BY v.timestamp DESC
		LIMIT  $%d
		OFFSET $%d
	`, where, limitArg, offsetArg)

	dataArgs := append(args, req.Limit, req.Offset)

	rows, err := r.pool.Query(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("query violations: %w", err)
	}
	defer rows.Close()

	var violations []models.Violation
	for rows.Next() {
		var viol models.Violation
		if err := rows.Scan(
			&viol.ID,
			&viol.VehicleID,
			&viol.VehicleNumber,
			&viol.DriverName,
			&viol.GeofenceID,
			&viol.GeofenceName,
			&viol.Category,
			&viol.EventType,
			&viol.Timestamp,
			&viol.AlertTriggered,
			&viol.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan violation: %w", err)
		}
		violations = append(violations, viol)
	}
	return violations, total, rows.Err()
}

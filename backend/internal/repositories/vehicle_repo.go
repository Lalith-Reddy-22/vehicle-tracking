package repositories

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mapup/vehicle-tracking/internal/models"
)

// VehicleRepository handles vehicle CRUD operations.
type VehicleRepository struct {
	pool *pgxpool.Pool
}

// NewVehicleRepository creates a new VehicleRepository.
func NewVehicleRepository(pool *pgxpool.Pool) *VehicleRepository {
	return &VehicleRepository{pool: pool}
}

// Create inserts a new vehicle. Returns (nil, ErrDuplicateVehicleNumber) on
// duplicate vehicle_number so the handler can return HTTP 409.
func (r *VehicleRepository) Create(ctx context.Context, req *models.CreateVehicleRequest) (*models.Vehicle, error) {
	var v models.Vehicle
	err := r.pool.QueryRow(ctx, `
		INSERT INTO vehicles (vehicle_number, driver_name, vehicle_type, phone)
		VALUES ($1, $2, $3, $4)
		RETURNING id, vehicle_number, driver_name, vehicle_type, phone, created_at, updated_at
	`, req.VehicleNumber, req.DriverName, req.VehicleType, req.Phone).
		Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		if isDuplicateKey(err) {
			return nil, ErrDuplicateVehicleNumber
		}
		return nil, fmt.Errorf("insert vehicle: %w", err)
	}
	return &v, nil
}

// List returns all registered vehicles.
func (r *VehicleRepository) List(ctx context.Context) ([]models.Vehicle, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, vehicle_number, driver_name, vehicle_type, phone, created_at, updated_at
		FROM vehicles
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("list vehicles: %w", err)
	}
	defer rows.Close()

	var vehicles []models.Vehicle
	for rows.Next() {
		var v models.Vehicle
		if err := rows.Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.CreatedAt, &v.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan vehicle: %w", err)
		}
		vehicles = append(vehicles, v)
	}
	return vehicles, rows.Err()
}

// GetByID returns a single vehicle. Returns nil, nil when not found.
func (r *VehicleRepository) GetByID(ctx context.Context, id string) (*models.Vehicle, error) {
	var v models.Vehicle
	err := r.pool.QueryRow(ctx, `
		SELECT id, vehicle_number, driver_name, vehicle_type, phone, created_at, updated_at
		FROM vehicles WHERE id = $1
	`, id).Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get vehicle: %w", err)
	}
	return &v, nil
}

// Update patches a vehicle's editable fields. Returns the updated record.
func (r *VehicleRepository) Update(ctx context.Context, id string, req *models.UpdateVehicleRequest) (*models.Vehicle, error) {
	var v models.Vehicle
	err := r.pool.QueryRow(ctx, `
		UPDATE vehicles
		SET driver_name   = COALESCE(NULLIF($2, ''), driver_name),
		    vehicle_type  = COALESCE(NULLIF($3, ''), vehicle_type),
		    phone         = COALESCE(NULLIF($4, ''), phone),
		    updated_at    = NOW()
		WHERE id = $1
		RETURNING id, vehicle_number, driver_name, vehicle_type, phone, created_at, updated_at
	`, id, req.DriverName, req.VehicleType, req.Phone).
		Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.CreatedAt, &v.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("update vehicle: %w", err)
	}
	return &v, nil
}

// Delete removes a vehicle by ID. Returns false when not found.
func (r *VehicleRepository) Delete(ctx context.Context, id string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `DELETE FROM vehicles WHERE id = $1`, id)
	if err != nil {
		return false, fmt.Errorf("delete vehicle: %w", err)
	}
	return tag.RowsAffected() > 0, nil
}

// ─── Sentinel errors ─────────────────────────────────────────────────────────

// ErrDuplicateVehicleNumber is returned when a vehicle_number already exists.
var ErrDuplicateVehicleNumber = fmt.Errorf("vehicle number already registered")

// isDuplicateKey detects a PostgreSQL unique constraint violation (SQLSTATE 23505).
func isDuplicateKey(err error) bool {
	return err != nil && strings.Contains(err.Error(), "23505")
}

package handlers

import (
	"net/http"
	"sync"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mapup/vehicle-tracking/internal/utils"
)

// StatsHandler handles the /stats route.
type StatsHandler struct {
	pool *pgxpool.Pool
}

// NewStatsHandler creates a new StatsHandler.
func NewStatsHandler(pool *pgxpool.Pool) *StatsHandler {
	return &StatsHandler{pool: pool}
}

// statsResponse is the JSON payload returned by GET /stats.
type statsResponse struct {
	TotalVehicles    int64 `json:"total_vehicles"`
	TotalGeofences   int64 `json:"total_geofences"`
	TotalViolations  int64 `json:"total_violations"`
	ActiveAlertRules int64 `json:"active_alert_rules"`
}

// Stats handles GET /stats.
// Runs four COUNT queries in parallel and returns the aggregated result.
func (h *StatsHandler) Stats(w http.ResponseWriter, r *http.Request) {
	type result struct {
		val int64
		err error
	}

	queries := []string{
		"SELECT COUNT(*) FROM vehicles",
		"SELECT COUNT(*) FROM geofences",
		"SELECT COUNT(*) FROM violations",
		"SELECT COUNT(*) FROM alert_rules WHERE is_active = true",
	}

	results := make([]result, len(queries))
	var wg sync.WaitGroup
	wg.Add(len(queries))

	for i, q := range queries {
		i, q := i, q // capture loop variables
		go func() {
			defer wg.Done()
			var count int64
			err := h.pool.QueryRow(r.Context(), q).Scan(&count)
			results[i] = result{val: count, err: err}
		}()
	}
	wg.Wait()

	for _, res := range results {
		if res.err != nil {
			utils.InternalError(w)
			return
		}
	}

	utils.JSON(w, http.StatusOK, statsResponse{
		TotalVehicles:    results[0].val,
		TotalGeofences:   results[1].val,
		TotalViolations:  results[2].val,
		ActiveAlertRules: results[3].val,
	})
}

// RegisterRoutes mounts stats routes onto the given Chi router.
func (h *StatsHandler) RegisterRoutes(r chi.Router) {
	r.Get("/stats", h.Stats)
}

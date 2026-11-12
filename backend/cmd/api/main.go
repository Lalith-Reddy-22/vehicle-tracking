// Package main is the entry point for the vehicle tracking API server.
// It wires together configuration, database, repositories, services, handlers,
// and the WebSocket hub.
package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/mapup/vehicle-tracking/internal/config"
	"github.com/mapup/vehicle-tracking/internal/database"
	"github.com/mapup/vehicle-tracking/internal/handlers"
	appmiddleware "github.com/mapup/vehicle-tracking/internal/middleware"
	"github.com/mapup/vehicle-tracking/internal/repositories"
	"github.com/mapup/vehicle-tracking/internal/services"
	"github.com/mapup/vehicle-tracking/internal/websocket"
)

func main() {
	// ── Structured logging ────────────────────────────────────────────────────
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})

	// ── Configuration ─────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load configuration")
	}
	if cfg.IsDevelopment() {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	// ── Database ──────────────────────────────────────────────────────────────
	ctx := context.Background()
	pool, err := database.New(ctx, &cfg.DB)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()

	// Resolve migrations directory relative to this binary's source file.
	// In the Docker image the binary is at /app/server and migrations at /app/migrations.
	migrationsDir := resolveMigrationsDir()
	if err := database.RunMigrations(ctx, pool, migrationsDir); err != nil {
		log.Fatal().Err(err).Msg("failed to run migrations")
	}

	// ── WebSocket Hub ─────────────────────────────────────────────────────────
	hub := websocket.NewHub(cfg.WS.ClientBuffer)
	go hub.Run()
	defer hub.Close()

	// ── Repositories ──────────────────────────────────────────────────────────
	geoRepo     := repositories.NewGeofenceRepository(pool)
	vehicleRepo := repositories.NewVehicleRepository(pool)
	locRepo     := repositories.NewLocationRepository(pool)
	violRepo    := repositories.NewViolationRepository(pool)
	alertRepo   := repositories.NewAlertRuleRepository(pool)

	// ── Services ──────────────────────────────────────────────────────────────
	locSvc := services.NewLocationService(pool, geoRepo, locRepo, violRepo, alertRepo, vehicleRepo, hub)

	// ── Handlers ──────────────────────────────────────────────────────────────
	geofenceHandler   := handlers.NewGeofenceHandler(geoRepo)
	vehicleHandler    := handlers.NewVehicleHandler(vehicleRepo, locSvc)
	alertRuleHandler  := handlers.NewAlertRuleHandler(alertRepo)
	violationHandler  := handlers.NewViolationHandler(violRepo)
	wsHandler         := handlers.NewWSHandler(hub, cfg.CORS.AllowedOrigins)
	statsHandler      := handlers.NewStatsHandler(pool)

	// ── Router ────────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// Global middleware (applied before timing so the full chain is measured).
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(appmiddleware.CORS(cfg.CORS.AllowedOrigins))
	r.Use(appmiddleware.TimingMiddleware)

	// Routes.
	geofenceHandler.RegisterRoutes(r)
	vehicleHandler.RegisterRoutes(r)
	alertRuleHandler.RegisterRoutes(r)
	violationHandler.RegisterRoutes(r)
	statsHandler.RegisterRoutes(r)
	r.Get("/ws/alerts", wsHandler.ServeWS)

	// Health check — excluded from timing middleware.
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// ── HTTP Server ───────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start in background.
	go func() {
		log.Info().Str("addr", srv.Addr).Str("env", cfg.Env).Msg("server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("server shutdown error")
	}
	log.Info().Msg("server stopped")
}

// resolveMigrationsDir returns the absolute path to the migrations directory.
// Works both when running via `go run` from the repo and from a Docker binary.
func resolveMigrationsDir() string {
	// In production Docker: binary is /app/server, migrations at /app/migrations.
	if _, err := os.Stat("/app/migrations"); err == nil {
		return "/app/migrations"
	}

	// During development: find relative to this source file.
	_, filename, _, _ := runtime.Caller(0)
	// filename = .../backend/cmd/api/main.go
	// migrations = .../backend/migrations
	dir := filepath.Join(filepath.Dir(filename), "..", "..", "migrations")
	abs, err := filepath.Abs(dir)
	if err != nil {
		return "migrations"
	}
	return abs
}

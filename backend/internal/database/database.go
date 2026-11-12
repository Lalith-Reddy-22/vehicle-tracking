// Package database provides a pgxpool connection pool factory and a simple
// migration runner. We use pgxpool (not database/sql) to retain access to
// pgx-native types such as pgtype.UUID and pgtype.Timestamptz without extra
// scanning adapters.
package database

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mapup/vehicle-tracking/internal/config"
	"github.com/rs/zerolog/log"
)

// New creates and validates a pgxpool connection pool using the supplied config.
func New(ctx context.Context, cfg *config.DBConfig) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}

	poolCfg.MaxConns = cfg.MaxConns
	poolCfg.MinConns = cfg.MinConns
	poolCfg.MaxConnIdleTime = time.Duration(cfg.MaxConnIdleSecs) * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// Verify connectivity immediately so we fail fast at startup.
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	log.Info().
		Str("host", poolCfg.ConnConfig.Host).
		Str("database", poolCfg.ConnConfig.Database).
		Int32("max_conns", cfg.MaxConns).
		Msg("database connected")

	return pool, nil
}

// RunMigrations applies all *.sql files found in migrationsDir in
// lexicographic (filename) order. Each file is wrapped in a transaction and
// is idempotent because we track applied files in schema_migrations.
//
// This is a lightweight migration runner sufficient for a self-contained
// assessment project. In production, use golang-migrate or Flyway.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool, migrationsDir string) error {
	// Ensure the tracking table exists.
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("read migrations dir %q: %w", migrationsDir, err)
	}

	var files []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)

	for _, name := range files {
		var already bool
		err := pool.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE filename = $1)`, name,
		).Scan(&already)
		if err != nil {
			return fmt.Errorf("check migration %q: %w", name, err)
		}
		if already {
			log.Debug().Str("migration", name).Msg("already applied, skipping")
			continue
		}

		content, err := os.ReadFile(filepath.Join(migrationsDir, name))
		if err != nil {
			return fmt.Errorf("read migration %q: %w", name, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("begin transaction for %q: %w", name, err)
		}

		if _, err := tx.Exec(ctx, string(content)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("execute migration %q: %w", name, err)
		}

		if _, err := tx.Exec(ctx,
			`INSERT INTO schema_migrations (filename) VALUES ($1)`, name,
		); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("record migration %q: %w", name, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit migration %q: %w", name, err)
		}

		log.Info().Str("migration", name).Msg("applied migration")
	}

	return nil
}

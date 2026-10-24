package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect пытается подключиться к Postgres с повторами: 30 попыток раз в 2 секунды.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	const (
		maxAttempts = 30
		delay       = 2 * time.Second
	)

	poolCfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	poolCfg.MaxConns = 10

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
		if err == nil {
			pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			err = pool.Ping(pingCtx)
			cancel()
			if err == nil {
				log.Printf("db connected (attempt %d)", attempt)
				return pool, nil
			}
			pool.Close()
		}
		log.Printf("db not ready (attempt %d/%d): %v", attempt, maxAttempts, err)
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
	}

	return nil, fmt.Errorf("db unavailable after %d attempts", maxAttempts)
}

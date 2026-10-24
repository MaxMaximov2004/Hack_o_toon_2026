package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"auth-service/internal/auth"
	"auth-service/internal/config"
	"auth-service/internal/db"
	"auth-service/internal/handler"
	"auth-service/internal/limiter"
	"auth-service/internal/seed"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	log.Println("auth-service starting")

	cfg := config.Load()

	// Подключение к БД с повторами (30 попыток × 2 сек).
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connection failed: %v", err)
	}
	defer pool.Close()

	// RSA-ключ для подписи JWT (генерируется и сохраняется если нет).
	signer, err := auth.LoadOrCreateSigner(cfg.JWTKeyPath, cfg.AccessTokenTTL, cfg.MFATokenTTL)
	if err != nil {
		log.Fatalf("signer init failed: %v", err)
	}
	log.Printf("signer ready (kid=%s)", signer.KID())

	// Сид пользователей (demo + admin).
	if err := seedUsers(pool, cfg); err != nil {
		log.Fatalf("seed users failed: %v", err)
	}

	// Лимитер попыток входа по паролю.
	emailLimiter := limiter.New()

	// HTTP-хендлеры.
	h := &handler.Handlers{
		DB:           pool,
		Signer:       signer,
		MFATokenTTL:  cfg.MFATokenTTL,
		EmailLimiter: emailLimiter,
	}

	// Маршрутизация.
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	h.Routes(r)

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	// Graceful shutdown.
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		sig := <-sigCh
		log.Printf("signal %s, shutting down", sig)
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("server shutdown: %v", err)
		}
	}()

	log.Printf("listening on :%s", cfg.Port)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf("listen error: %v", err)
	}
	log.Println("stopped")
}

// seedUsers создаёт демо и админ-пользователей в auth.users.
func seedUsers(pool *pgxpool.Pool, cfg config.Config) error {
	users := []seed.User{
		{
			Email:      cfg.DemoUserEmail,
			Password:   cfg.DemoUserPassword,
			FullName:   "Демо Менеджер",
			Roles:      []string{"manager"},
			TOTPSecret: strPtr(cfg.DemoTOTPSecret),
		},
		{
			Email:      cfg.AdminUserEmail,
			Password:   cfg.AdminUserPassword,
			FullName:   "Администратор",
			Roles:      []string{"admin", "manager"},
			TOTPSecret: nil,
		},
	}
	return seed.SeedUsers(context.Background(), pool, users)
}

func strPtr(s string) *string { return &s }

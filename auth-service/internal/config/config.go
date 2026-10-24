package config

import (
	"os"
	"time"
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTKeyPath     string
	AccessTokenTTL time.Duration
	MFATokenTTL    time.Duration

	// InternalToken — общий секрет X-Internal-Token из docker-compose.
	// auth-service его не проверяет: единственный /internal/ маршрут — JWKS,
	// а соседи тянут его без заголовков (Spring и .NET JWKS-клиенты их не ставят).
	// Читаем, чтобы контракт переменных окружения совпадал с compose.
	InternalToken string

	DemoUserEmail     string
	DemoUserPassword  string
	DemoTOTPSecret    string
	AdminUserEmail    string
	AdminUserPassword string
}

func Load() Config {
	return Config{
		Port:              getEnv("PORT", "8081"),
		DatabaseURL:       getEnv("DATABASE_URL", ""),
		JWTKeyPath:        getEnv("JWT_KEY_PATH", ""),
		AccessTokenTTL:    parseDuration("ACCESS_TOKEN_TTL", 8*time.Hour),
		MFATokenTTL:       parseDuration("MFA_TOKEN_TTL", 5*time.Minute),
		InternalToken:     getEnv("INTERNAL_TOKEN", ""),
		DemoUserEmail:     getEnv("DEMO_USER_EMAIL", "demo@rt.ru"),
		DemoUserPassword:  getEnv("DEMO_USER_PASSWORD", "Demo2026!"),
		DemoTOTPSecret:    getEnv("DEMO_TOTP_SECRET", "JBSWY3DPEHPK3PXP"),
		AdminUserEmail:    getEnv("ADMIN_USER_EMAIL", "admin@rt.ru"),
		AdminUserPassword: getEnv("ADMIN_USER_PASSWORD", "Admin2026!"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func parseDuration(key string, defaultVal time.Duration) time.Duration {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	d, err := time.ParseDuration(val)
	if err != nil {
		return defaultVal
	}
	return d
}

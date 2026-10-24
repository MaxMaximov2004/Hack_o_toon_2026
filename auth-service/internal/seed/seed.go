package seed

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// User — модель пользователя для сида.
type User struct {
	Email      string
	Password   string // plaintext — будет захэширован bcrypt cost 10
	FullName   string
	Roles      []string
	TOTPSecret *string // nil если 2FA не привязан
}

// SeedUsers upsert демо-пользователей. Таблицу auth.users не создаём.
//
// Привязку 2FA не затираем: если пользователь уже прошёл verify
// (totp_enabled = true), а в сиде для него 2FA выключен (как у админа),
// оставляем секрет и флаг как есть. Иначе рестарт контейнера откатывал бы
// админа к QR-экрану и код на телефоне докладчика перставал подходить.
func SeedUsers(ctx context.Context, pool *pgxpool.Pool, users []User) error {
	const q = `
		INSERT INTO auth.users (email, password_hash, full_name, roles, totp_secret, totp_enabled)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (email) DO UPDATE SET
			password_hash = EXCLUDED.password_hash,
			full_name     = EXCLUDED.full_name,
			roles         = EXCLUDED.roles,
			totp_secret   = CASE WHEN auth.users.totp_enabled AND NOT EXCLUDED.totp_enabled
			                     THEN auth.users.totp_secret
			                     ELSE EXCLUDED.totp_secret END,
			totp_enabled  = CASE WHEN auth.users.totp_enabled AND NOT EXCLUDED.totp_enabled
			                     THEN true
			                     ELSE EXCLUDED.totp_enabled END
	`

	for _, u := range users {
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash password for %s: %w", u.Email, err)
		}
		totpEnabled := u.TOTPSecret != nil

		_, err = pool.Exec(ctx, q,
			u.Email, string(hash), u.FullName, u.Roles, u.TOTPSecret, totpEnabled)
		if err != nil {
			return fmt.Errorf("upsert user %s: %w", u.Email, err)
		}
	}

	log.Printf("seeded %d users", len(users))
	return nil
}

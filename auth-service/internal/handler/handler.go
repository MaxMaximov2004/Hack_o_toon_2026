package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strings"
	"time"

	"auth-service/internal/auth"
	"auth-service/internal/limiter"
	"auth-service/internal/mfa"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// --- Константы ---

const (
	// Фиктивный bcrypt-хэш — чтобы время ответа на неизвестный email
	// совпадало со временем проверки реального пароля.
	fakeBcryptHash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
	bcryptCost     = 10
)

// --- Зависимости ---

// Handlers — зависимости для всех хендлеров.
// InternalToken (X-Internal-Token) auth-service не использует: единственный
// /internal/ маршрут — JWKS, его соседи тянут без заголовков (см. 05-go-auth.md).
type Handlers struct {
	DB           *pgxpool.Pool
	Signer       *auth.Signer
	MFATokenTTL  time.Duration
	EmailLimiter *limiter.EmailLimiter
}

// --- DTO ---

type errorBody struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

type errorEnvelope struct {
	Error errorBody `json:"error"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	MFAToken         string `json:"mfaToken"`
	MFASetupRequired bool   `json:"mfaSetupRequired"`
	OTPAuthURL       string `json:"otpauthUrl,omitempty"`
	QRPNGBase64      string `json:"qrPngBase64,omitempty"`
}

type verifyRequest struct {
	MFAToken string `json:"mfaToken"`
	Code     string `json:"code"`
}

type verifyResponse struct {
	AccessToken string       `json:"accessToken"`
	ExpiresIn   int64        `json:"expiresIn"`
	User        userResponse `json:"user"`
}

type userResponse struct {
	ID       int64    `json:"id"`
	Email    string   `json:"email"`
	FullName string   `json:"fullName"`
	Roles    []string `json:"roles"`
}

type registerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"fullName"`
}

type healthResponse struct {
	Status string `json:"status"`
}

type jwksKey struct {
	Kty string `json:"kty"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	KID string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jwksResponse struct {
	Keys []jwksKey `json:"keys"`
}

// internalUser — строка из auth.users.
type internalUser struct {
	ID           int64
	Email        string
	PasswordHash string
	FullName     string
	Roles        []string
	TOTPSecret   *string
	TOTPEnabled  bool
}

// --- Маршрутизация ---

// Routes вешает все маршруты на переданный роутер.
func (h *Handlers) Routes(r chi.Router) {
	r.Get("/health", h.handleHealth)
	r.Route("/api/auth", func(ar chi.Router) {
		ar.Post("/login", h.handleLogin)
		ar.Post("/2fa/verify", h.handleVerify2FA)
		ar.Get("/me", h.handleMe)
		ar.Post("/register", h.handleRegister)
	})
	r.Get("/internal/auth/jwks", h.handleJWKS)
}

// --- /health ---

func (h *Handlers) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := h.DB.Ping(ctx); err != nil {
		log.Printf("health: db ping failed: %v", err)
		writeJSON(w, http.StatusServiceUnavailable, healthResponse{Status: "error"})
		return
	}
	writeJSON(w, http.StatusOK, healthResponse{Status: "ok"})
}

// --- POST /api/auth/login ---

func (h *Handlers) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "VALIDATION_ERROR", "неверный формат запроса")
		return
	}

	email := sanitizeEmail(req.Email)
	if email == "" || req.Password == "" {
		// Timing-safe: всё равно выполняем bcrypt
		_ = bcrypt.CompareHashAndPassword([]byte(fakeBcryptHash), []byte(req.Password))
		writeErr(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Неверный email или пароль")
		return
	}

	if !h.EmailLimiter.Allow(email) {
		writeErr(w, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS", "Слишком много попыток входа")
		return
	}

	user, err := h.findUserByEmail(r.Context(), email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			_ = bcrypt.CompareHashAndPassword([]byte(fakeBcryptHash), []byte(req.Password))
			writeErr(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Неверный email или пароль")
			return
		}
		log.Printf("login: db error: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeErr(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Неверный email или пароль")
		return
	}

	// Если 2FA ещё не привязан — генерируем secret (если нет) и отдаём QR
	setupRequired := !user.TOTPEnabled
	var otpAuthURL, qrPng string

	if setupRequired {
		key, err := h.ensureTOTPSecret(r.Context(), user)
		if err != nil {
			log.Printf("login: totp setup failed: %v", err)
			writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
			return
		}
		otpAuthURL = key.URL()
		if b64, err := mfa.QRBase64(key); err == nil {
			qrPng = b64
		} else {
			log.Printf("login: qr image failed: %v", err)
		}
	}

	// MFA-сессия
	sessionID := uuid.New()
	expiresAt := time.Now().UTC().Add(h.MFATokenTTL)
	if _, err := h.DB.Exec(r.Context(),
		`INSERT INTO auth.mfa_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)`,
		sessionID, user.ID, expiresAt); err != nil {
		log.Printf("login: create mfa session: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	mfaToken, err := h.Signer.NewMFAToken(user.ID, sessionID)
	if err != nil {
		log.Printf("login: sign mfa token: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		MFAToken:         mfaToken,
		MFASetupRequired: setupRequired,
		OTPAuthURL:       otpAuthURL,
		QRPNGBase64:      qrPng,
	})
}

// ensureTOTPSecret — возвращает ключ для QR, создав secret если его ещё нет.
// Secret сохраняется, но totp_enabled остаётся false (включится после успешного verify).
func (h *Handlers) ensureTOTPSecret(ctx context.Context, user *internalUser) (*mfa.Key, error) {
	if user.TOTPSecret != nil && *user.TOTPSecret != "" {
		return mfa.KeyFromSecret(*user.TOTPSecret, user.Email)
	}
	key, err := mfa.GenerateSecret(user.Email)
	if err != nil {
		return nil, err
	}
	if _, err := h.DB.Exec(ctx,
		`UPDATE auth.users SET totp_secret = $1 WHERE id = $2`,
		key.Secret(), user.ID); err != nil {
		return nil, err
	}
	user.TOTPSecret = strPtr(key.Secret())
	return key, nil
}

// --- POST /api/auth/2fa/verify ---

func (h *Handlers) handleVerify2FA(w http.ResponseWriter, r *http.Request) {
	var req verifyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "VALIDATION_ERROR", "неверный формат запроса")
		return
	}

	mfaClaims, err := h.Signer.ValidateMFAToken(req.MFAToken)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Неверный или истёкший токен 2FA")
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(mfaClaims.Subject, "%d", &userID); err != nil {
		writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Неверный токен 2FA")
		return
	}

	sessionUUID, err := uuid.Parse(mfaClaims.ID)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Неверный токен 2FA")
		return
	}
	_ = userID // id берём из сессии, sub в токене — для аудита

	tx, err := h.DB.Begin(r.Context())
	if err != nil {
		log.Printf("verify: begin tx: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}
	defer tx.Rollback(r.Context())

	var session struct {
		UserID    int64
		ExpiresAt time.Time
		Used      bool
		Attempts  int
	}
	err = tx.QueryRow(r.Context(),
		`SELECT user_id, expires_at, used, attempts
		   FROM auth.mfa_sessions WHERE id = $1 FOR UPDATE`,
		sessionUUID).
		Scan(&session.UserID, &session.ExpiresAt, &session.Used, &session.Attempts)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Сессия 2FA не найдена")
			return
		}
		log.Printf("verify: load session: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	if session.Used || session.Attempts >= 5 || time.Now().UTC().After(session.ExpiresAt) {
		writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Сессия 2FA недействительна")
		return
	}

	// Забираем секрет под FOR UPDATE — защита от параллельного setup
	var (
		secret      *string
		totpEnabled bool
	)
	err = tx.QueryRow(r.Context(),
		`SELECT totp_secret, totp_enabled FROM auth.users WHERE id = $1 FOR UPDATE`,
		session.UserID).
		Scan(&secret, &totpEnabled)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Пользователь не найден")
			return
		}
		log.Printf("verify: load user: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	if secret == nil || *secret == "" {
		writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "2FA не настроен")
		return
	}

	// Формат кода: ровно 6 цифр, иначе 400 (по ТЗ) — попытки не увеличиваем.
	if len(req.Code) != 6 || !isDigits(req.Code) {
		_ = tx.Rollback(r.Context())
		writeErrField(w, http.StatusBadRequest, "VALIDATION_ERROR", "код должен содержать ровно 6 цифр", "code")
		return
	}

	// Проверка TOTP: SHA1, период 30 с, допуск соседнего шага.
	codeOK := mfa.ValidateCode(req.Code, *secret)

	if !codeOK {
		newAttempts := session.Attempts + 1
		burned := newAttempts >= 5
		if _, err := tx.Exec(r.Context(),
			`UPDATE auth.mfa_sessions SET attempts = $1, used = $2 WHERE id = $3`,
			newAttempts, burned, sessionUUID); err != nil {
			log.Printf("verify: update attempts: %v", err)
			writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
			return
		}
		if err := tx.Commit(r.Context()); err != nil {
			log.Printf("verify: commit attempts: %v", err)
			writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
			return
		}
		if burned {
			writeErr(w, http.StatusTooManyRequests, "TOO_MANY_ATTEMPTS", "Слишком много попыток")
			return
		}
		writeErr(w, http.StatusUnauthorized, "INVALID_CODE", "Неверный код")
		return
	}

	// Код верный: сжигаем сессию, привязываем 2FA при первом входе
	if _, err := tx.Exec(r.Context(),
		`UPDATE auth.mfa_sessions SET used = true WHERE id = $1`, sessionUUID); err != nil {
		log.Printf("verify: consume session: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}
	if !totpEnabled {
		if _, err := tx.Exec(r.Context(),
			`UPDATE auth.users SET totp_enabled = true WHERE id = $1`,
			session.UserID); err != nil {
			log.Printf("verify: enable totp: %v", err)
			writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
			return
		}
	}

	var user internalUser
	err = tx.QueryRow(r.Context(),
		`SELECT id, email, full_name, roles FROM auth.users WHERE id = $1`,
		session.UserID).
		Scan(&user.ID, &user.Email, &user.FullName, &user.Roles)
	if err != nil {
		log.Printf("verify: load user: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		log.Printf("verify: commit: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	accessToken, _, err := h.Signer.NewAccessToken(user.ID, user.Email, user.FullName, user.Roles)
	if err != nil {
		log.Printf("verify: sign access token: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	writeJSON(w, http.StatusOK, verifyResponse{
		AccessToken: accessToken,
		ExpiresIn:   int64(h.Signer.AccessTTL().Seconds()),
		User: userResponse{
			ID:       user.ID,
			Email:    user.Email,
			FullName: user.FullName,
			Roles:    user.Roles,
		},
	})
}

// --- GET /api/auth/me ---

func (h *Handlers) handleMe(w http.ResponseWriter, r *http.Request) {
	claims, err := h.authenticate(r)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Требуется авторизация")
		return
	}

	var userID int64
	if _, err := fmt.Sscanf(claims.Subject, "%d", &userID); err != nil {
		writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Неверный токен")
		return
	}

	var user internalUser
	err = h.DB.QueryRow(r.Context(),
		`SELECT id, email, full_name, roles FROM auth.users WHERE id = $1`,
		userID).
		Scan(&user.ID, &user.Email, &user.FullName, &user.Roles)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Пользователь не найден")
			return
		}
		log.Printf("me: load user: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	writeJSON(w, http.StatusOK, userResponse{
		ID:       user.ID,
		Email:    user.Email,
		FullName: user.FullName,
		Roles:    user.Roles,
	})
}

// --- POST /api/auth/register ---

func (h *Handlers) handleRegister(w http.ResponseWriter, r *http.Request) {
	claims, err := h.authenticate(r)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, "UNAUTHORIZED", "Требуется авторизация")
		return
	}
	if !containsStr(claims.Roles, "admin") {
		writeErr(w, http.StatusForbidden, "FORBIDDEN", "Недостаточно прав")
		return
	}

	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, "VALIDATION_ERROR", "неверный формат запроса")
		return
	}

	req.Email = sanitizeEmail(req.Email)
	switch {
	case req.Email == "" || req.Password == "" || req.FullName == "":
		writeErrField(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"email, password, fullName обязательны", "email")
		return
	case len(req.Password) < 8:
		writeErrField(w, http.StatusBadRequest, "VALIDATION_ERROR",
			"пароль короче 8 символов", "password")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		log.Printf("register: bcrypt: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	var userID int64
	err = h.DB.QueryRow(r.Context(),
		`INSERT INTO auth.users (email, password_hash, full_name, roles, totp_secret, totp_enabled)
		 VALUES ($1, $2, $3, $4, NULL, false) RETURNING id`,
		req.Email, string(hash), req.FullName, []string{"manager"}).
		Scan(&userID)
	if err != nil {
		if isUniqueViolation(err) {
			writeErr(w, http.StatusConflict, "EMAIL_TAKEN", "Email уже занят")
			return
		}
		log.Printf("register: insert: %v", err)
		writeErr(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Внутренняя ошибка")
		return
	}

	writeJSON(w, http.StatusCreated, userResponse{
		ID:       userID,
		Email:    req.Email,
		FullName: req.FullName,
		Roles:    []string{"manager"},
	})
}

// --- GET /internal/auth/jwks ---

func (h *Handlers) handleJWKS(w http.ResponseWriter, r *http.Request) {
	pub := h.Signer.PublicKey()
	resp := jwksResponse{
		Keys: []jwksKey{{
			Kty: "RSA",
			Use: "sig",
			Alg: "RS256",
			KID: h.Signer.KID(),
			N:   auth.Base64URLRaw(pub.N.Bytes()),
			E:   auth.Base64URLRaw(big.NewInt(int64(pub.E)).Bytes()),
		}},
	}
	w.Header().Set("Cache-Control", "max-age=600")
	writeJSON(w, http.StatusOK, resp)
}

// --- Helpers ---

func (h *Handlers) authenticate(r *http.Request) (*auth.UserClaims, error) {
	hdr := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if !strings.HasPrefix(hdr, prefix) {
		return nil, errors.New("missing bearer token")
	}
	return h.Signer.ValidateAccessToken(strings.TrimPrefix(hdr, prefix))
}

func (h *Handlers) findUserByEmail(ctx context.Context, email string) (*internalUser, error) {
	var u internalUser
	err := h.DB.QueryRow(ctx,
		`SELECT id, email, password_hash, full_name, roles, totp_secret, totp_enabled
		   FROM auth.users WHERE email = $1`, email).
		Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Roles, &u.TOTPSecret, &u.TOTPEnabled)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("write json: %v", err)
	}
}

func writeErr(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorEnvelope{Error: errorBody{Code: code, Message: message}})
}

func writeErrField(w http.ResponseWriter, status int, code, message, field string) {
	writeJSON(w, status, errorEnvelope{Error: errorBody{
		Code:    code,
		Message: message,
		Details: map[string]string{"field": field},
	}})
}

func sanitizeEmail(e string) string {
	return strings.ToLower(strings.TrimSpace(e))
}

func containsStr(list []string, x string) bool {
	for _, v := range list {
		if v == x {
			return true
		}
	}
	return false
}

func isDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

func strPtr(s string) *string { return &s }

// isUniqueViolation — без pgconn ради одной проверки.
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "duplicate key value") ||
		strings.Contains(msg, "23505")
}

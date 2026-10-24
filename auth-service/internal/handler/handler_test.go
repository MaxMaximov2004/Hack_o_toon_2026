package handler

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"auth-service/internal/auth"
	"auth-service/internal/limiter"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func newTestHandlers(t *testing.T) *Handlers {
	t.Helper()
	signer, err := auth.LoadOrCreateSigner(
		filepath.Join(t.TempDir(), "jwt.pem"), 8*time.Hour, 5*time.Minute)
	if err != nil {
		t.Fatalf("signer: %v", err)
	}
	return &Handlers{
		Signer:       signer,
		MFATokenTTL:  5 * time.Minute,
		EmailLimiter: limiter.New(),
	}
}

func doRequest(t *testing.T, h *Handlers, method, path string, header map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	r := chi.NewRouter()
	h.Routes(r)
	req := httptest.NewRequest(method, path, nil)
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

// JWKS — формат ключа, обязательный для core-api / export-service / notifier.
func TestJWKS_Shape(t *testing.T) {
	h := newTestHandlers(t)
	rec := doRequest(t, h, http.MethodGet, "/internal/auth/jwks", nil)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "max-age=600" {
		t.Errorf("Cache-Control = %q, want max-age=600", cc)
	}

	var resp jwksResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("bad json: %v", err)
	}
	if len(resp.Keys) != 1 {
		t.Fatalf("keys = %d, want 1", len(resp.Keys))
	}

	k := resp.Keys[0]
	if k.Kty != "RSA" || k.Use != "sig" || k.Alg != "RS256" {
		t.Errorf("unexpected key meta %+v", k)
	}
	if k.KID != h.Signer.KID() {
		t.Errorf("kid = %q, want %q", k.KID, h.Signer.KID())
	}

	// n и e — base64url без паддинга
	for name, v := range map[string]string{"n": k.N, "e": k.E} {
		if _, err := base64.RawURLEncoding.DecodeString(v); err != nil {
			t.Errorf("%s is not base64url: %v", name, err)
		}
	}

	// e = 65537
	eBytes, _ := base64.RawURLEncoding.DecodeString(k.E)
	if new(big.Int).SetBytes(eBytes).Int64() != 65537 {
		t.Errorf("e = %v, want 65537", new(big.Int).SetBytes(eBytes))
	}

	// n восстанавливается в публичный ключ того же размера, что и у подписанта
	nBytes, _ := base64.RawURLEncoding.DecodeString(k.N)
	modulus := new(big.Int).SetBytes(nBytes)
	if bits := modulus.BitLen(); bits != 2048 {
		t.Errorf("modulus bits = %d, want 2048", bits)
	}
}

// Ошибки — общий формат { "error": { code, message, details } } из 00-common.
func TestErrorShape(t *testing.T) {
	h := newTestHandlers(t)

	rec := doRequest(t, h, http.MethodGet, "/api/auth/me", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}

	var env errorEnvelope
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("bad json: %v (body=%s)", err, rec.Body.String())
	}
	if env.Error.Code != "UNAUTHORIZED" {
		t.Errorf("code = %q, want UNAUTHORIZED", env.Error.Code)
	}
	if env.Error.Message == "" {
		t.Error("message must not be empty")
	}
}

// mfaToken не проходит как accessToken ни на одном защищённом маршруте.
func TestMFAToken_RejectedOnProtectedRoutes(t *testing.T) {
	h := newTestHandlers(t)

	mfaTok, err := h.Signer.NewMFAToken(1, uuid.New())
	if err != nil {
		t.Fatalf("NewMFAToken: %v", err)
	}
	authHdr := map[string]string{"Authorization": "Bearer " + mfaTok}

	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/api/auth/me"},
		{http.MethodPost, "/api/auth/register"},
	} {
		rec := doRequest(t, h, tc.method, tc.path, authHdr)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: status = %d, want 401", tc.method, tc.path, rec.Code)
		}
	}
}

// Без токена — 401 в общем формате, не пустой ответ.
func TestRegister_RejectsAnonymous(t *testing.T) {
	h := newTestHandlers(t)
	rec := doRequest(t, h, http.MethodPost, "/api/auth/register", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

// Пользователь без роли admin не может регистрировать.
func TestRegister_ForbiddenWithoutAdmin(t *testing.T) {
	h := newTestHandlers(t)

	tok, _, err := h.Signer.NewAccessToken(1, "m@rt.ru", "Менеджер", []string{"manager"})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	rec := doRequest(t, h, http.MethodPost, "/api/auth/register", map[string]string{
		"Authorization": "Bearer " + tok,
	})
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

// /internal/auth/jwks доступен без JWT (сеть внутренняя, nginx закрывает /internal/).
func TestJWKS_NoAuthRequired(t *testing.T) {
	h := newTestHandlers(t)
	rec := doRequest(t, h, http.MethodGet, "/internal/auth/jwks", nil)
	if rec.Code == http.StatusUnauthorized || rec.Code == http.StatusForbidden {
		t.Fatalf("jwks must not require auth, got %d", rec.Code)
	}
}

// Интероперабельность: соседний сервис (core-api, export-service, notifier)
// проверяет accessToken ТОЛЬКО по JWKS — восстанавливает RSA-ключ из n/e и верифицирует.
func TestToken_VerifiableFromJWKSAlone(t *testing.T) {
	h := newTestHandlers(t)

	token, _, err := h.Signer.NewAccessToken(1, "demo@rt.ru", "Демо Менеджер", []string{"manager"})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	rec := doRequest(t, h, http.MethodGet, "/internal/auth/jwks", nil)
	var resp jwksResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("bad jwks json: %v", err)
	}

	nBytes, err := base64.RawURLEncoding.DecodeString(resp.Keys[0].N)
	if err != nil {
		t.Fatalf("decode n: %v", err)
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(resp.Keys[0].E)
	if err != nil {
		t.Fatalf("decode e: %v", err)
	}

	pub := &rsa.PublicKey{
		N: new(big.Int).SetBytes(nBytes),
		E: int(new(big.Int).SetBytes(eBytes).Int64()),
	}

	claims := &auth.UserClaims{}
	parser := jwt.NewParser(jwt.WithValidMethods([]string{"RS256"}), jwt.WithIssuer(auth.Issuer))
	parsed, err := parser.ParseWithClaims(token, claims, func(tok *jwt.Token) (interface{}, error) {
		if got, _ := tok.Header["kid"].(string); got != resp.Keys[0].KID {
			return nil, errors.New("kid mismatch: " + got)
		}
		return pub, nil
	})
	if err != nil {
		t.Fatalf("verify with JWKS key failed: %v", err)
	}
	if !parsed.Valid {
		t.Fatal("token not valid")
	}
	if claims.Email != "demo@rt.ru" || claims.Name != "Демо Менеджер" {
		t.Errorf("claims lost in transit: %+v", claims)
	}
	if !slices.Contains(claims.Amr, "otp") {
		t.Errorf(`amr must contain "otp" so neighbours accept it, got %v`, claims.Amr)
	}
}

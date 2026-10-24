package auth

import (
	"encoding/base64"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func newTestSigner(t *testing.T) *Signer {
	t.Helper()
	s, err := LoadOrCreateSigner(filepath.Join(t.TempDir(), "jwt.pem"), 8*time.Hour, 5*time.Minute)
	if err != nil {
		t.Fatalf("LoadOrCreateSigner: %v", err)
	}
	return s
}

// Ключ переживает перезапуск: повторная загрузка читает тот же файл.
func TestSigner_KeyPersistsAcrossRestarts(t *testing.T) {
	path := filepath.Join(t.TempDir(), "jwt-private.pem")

	first, err := LoadOrCreateSigner(path, time.Hour, time.Minute)
	if err != nil {
		t.Fatalf("first load: %v", err)
	}
	second, err := LoadOrCreateSigner(path, time.Hour, time.Minute)
	if err != nil {
		t.Fatalf("second load: %v", err)
	}

	if first.KID() != second.KID() {
		t.Fatalf("kid changed after reload: %s != %s", first.KID(), second.KID())
	}

	tok, _, err := first.NewAccessToken(1, "demo@rt.ru", "Демо", []string{"manager"})
	if err != nil {
		t.Fatalf("NewAccessToken: %v", err)
	}
	if _, err := second.ValidateAccessToken(tok); err != nil {
		t.Fatalf("token from previous run must stay valid: %v", err)
	}
}

// kid = первые 16 символов base64url(SHA-256(SPKI DER)).
func TestKID_Format(t *testing.T) {
	s := newTestSigner(t)
	if len(s.KID()) != kidLen {
		t.Fatalf("kid length = %d, want %d", len(s.KID()), kidLen)
	}
	if _, err := base64.RawURLEncoding.DecodeString(s.KID()); err != nil {
		t.Fatalf("kid is not base64url: %v", err)
	}
	if strings.ContainsAny(s.KID(), "+/=") {
		t.Fatalf("kid must be base64url without padding, got %q", s.KID())
	}
}

func TestAccessToken_ClaimsMatchContract(t *testing.T) {
	s := newTestSigner(t)

	tok, exp, err := s.NewAccessToken(42, "demo@rt.ru", "Демо Менеджер", []string{"manager"})
	if err != nil {
		t.Fatalf("NewAccessToken: %v", err)
	}
	if want := time.Now().UTC().Add(8 * time.Hour); exp.Sub(want) > time.Minute || want.Sub(exp) > time.Minute {
		t.Fatalf("exp = %v, want ~%v", exp, want)
	}

	c, err := s.ValidateAccessToken(tok)
	if err != nil {
		t.Fatalf("ValidateAccessToken: %v", err)
	}
	if c.Issuer != Issuer {
		t.Errorf("iss = %q, want %q", c.Issuer, Issuer)
	}
	if c.Subject != "42" {
		t.Errorf("sub = %q, want 42", c.Subject)
	}
	if c.Email != "demo@rt.ru" {
		t.Errorf("email = %q", c.Email)
	}
	if c.Name != "Демо Менеджер" {
		t.Errorf("name = %q", c.Name)
	}
	if len(c.Roles) != 1 || c.Roles[0] != "manager" {
		t.Errorf("roles = %v", c.Roles)
	}
	if !contains(c.Amr, AmrOTP) || !contains(c.Amr, AmrPwd) {
		t.Errorf("amr = %v, want pwd+otp", c.Amr)
	}
	if c.ID == "" {
		t.Error("jti must be set")
	}
	if c.IssuedAt == nil {
		t.Error("iat must be set")
	}
}

// mfaToken НЕ должен приниматься как accessToken: нет otp в amr.
func TestMFAToken_NotAcceptedAsAccessToken(t *testing.T) {
	s := newTestSigner(t)

	session := uuid.New()
	mfaTok, err := s.NewMFAToken(7, session)
	if err != nil {
		t.Fatalf("NewMFAToken: %v", err)
	}

	if _, err := s.ValidateAccessToken(mfaTok); err == nil {
		t.Fatal("mfa token must be rejected as access token")
	}

	mc, err := s.ValidateMFAToken(mfaTok)
	if err != nil {
		t.Fatalf("ValidateMFAToken: %v", err)
	}
	if mc.Typ != "mfa" {
		t.Errorf("typ = %q, want mfa", mc.Typ)
	}
	if mc.ID != session.String() {
		t.Errorf("jti = %q, want %q", mc.ID, session)
	}
	if len(mc.Amr) != 1 || mc.Amr[0] != AmrPwd {
		t.Errorf("amr = %v, want [pwd]", mc.Amr)
	}
	if mc.Subject != "7" {
		t.Errorf("sub = %q, want 7", mc.Subject)
	}
}

// accessToken НЕ проходит как mfaToken — проверка typ защищает от подмены шагов.
func TestAccessToken_NotAcceptedAsMFAToken(t *testing.T) {
	s := newTestSigner(t)
	tok, _, err := s.NewAccessToken(1, "a@b.ru", "A", []string{"manager"})
	if err != nil {
		t.Fatalf("NewAccessToken: %v", err)
	}
	if _, err := s.ValidateMFAToken(tok); err == nil {
		t.Fatal("access token must not pass as mfa token")
	}
}

func TestValidate_RejectsBadTokens(t *testing.T) {
	s := newTestSigner(t)
	other := newTestSigner(t) // другой ключ

	tok, _, err := s.NewAccessToken(1, "a@b.ru", "A", []string{"manager"})
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	t.Run("foreign key", func(t *testing.T) {
		if _, err := other.ValidateAccessToken(tok); err == nil {
			t.Fatal("token signed by another key must be rejected")
		}
	})

	t.Run("tampered", func(t *testing.T) {
		bad := tok[:len(tok)-4] + "AAAA"
		if _, err := s.ValidateAccessToken(bad); err == nil {
			t.Fatal("tampered signature must be rejected")
		}
	})

	t.Run("garbage", func(t *testing.T) {
		if _, err := s.ValidateAccessToken("not-a-jwt"); err == nil {
			t.Fatal("garbage must be rejected")
		}
	})

	t.Run("expired", func(t *testing.T) {
		short, err := LoadOrCreateSigner(
			filepath.Join(t.TempDir(), "k.pem"), time.Millisecond, time.Millisecond)
		if err != nil {
			t.Fatalf("signer: %v", err)
		}
		expired, _, err := short.NewAccessToken(1, "a@b.ru", "A", []string{"manager"})
		if err != nil {
			t.Fatalf("sign: %v", err)
		}
		time.Sleep(20 * time.Millisecond)
		if _, err := short.ValidateAccessToken(expired); err == nil {
			t.Fatal("expired token must be rejected")
		}
	})

	t.Run("wrong issuer", func(t *testing.T) {
		// Тот же ключ, но чужой iss — проверка iss обязательна.
		now := time.Now().UTC()
		tok := jwt.NewWithClaims(jwt.SigningMethodRS256, UserClaims{
			Email: "a@b.ru",
			Amr:   []string{AmrPwd, AmrOTP},
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    "evil",
				Subject:   "1",
				IssuedAt:  jwt.NewNumericDate(now),
				ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			},
		})
		bad, err := tok.SignedString(s.priv)
		if err != nil {
			t.Fatalf("sign: %v", err)
		}
		if _, err := s.ValidateAccessToken(bad); err == nil {
			t.Fatal("foreign issuer must be rejected")
		}
	})

	t.Run("amr without otp", func(t *testing.T) {
		now := time.Now().UTC()
		tok := jwt.NewWithClaims(jwt.SigningMethodRS256, UserClaims{
			Email: "a@b.ru",
			Amr:   []string{AmrPwd},
			RegisteredClaims: jwt.RegisteredClaims{
				Issuer:    Issuer,
				Subject:   "1",
				IssuedAt:  jwt.NewNumericDate(now),
				ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
			},
		})
		bad, err := tok.SignedString(s.priv)
		if err != nil {
			t.Fatalf("sign: %v", err)
		}
		if _, err := s.ValidateAccessToken(bad); err == nil {
			t.Fatal(`token without "otp" in amr must be rejected`)
		}
	})
}

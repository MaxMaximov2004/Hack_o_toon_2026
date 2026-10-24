package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	// Issuer — обязателен во всех токенах, его проверяют соседние сервисы.
	Issuer = "radar-auth"

	keyBits  = 2048
	kidLen   = 16
	algRS256 = "RS256"

	typeMFA = "mfa"
)

// AmrOTP / AmrPwd — значения claim amr. Соседи принимают токен только с "otp".
const (
	AmrPwd = "pwd"
	AmrOTP = "otp"
)

// Signer хранит RSA-ключ и выпускает/проверяет токены.
type Signer struct {
	priv      *rsa.PrivateKey
	kid       string
	accessTTL time.Duration
	mfaTTL    time.Duration
}

// UserClaims — payload accessToken (его принимают core-api, export-service, notifier).
type UserClaims struct {
	Email string   `json:"email"`
	Name  string   `json:"name"`
	Roles []string `json:"roles"`
	Amr   []string `json:"amr"`
	jwt.RegisteredClaims
}

// MFAClaims — payload mfaToken. Промежуточный токен шага 1: typ=mfa, amr=["pwd"].
type MFAClaims struct {
	Typ string   `json:"typ"`
	Amr []string `json:"amr"`
	jwt.RegisteredClaims
}

// LoadOrCreateSigner читает PEM из keyPath; если файла нет — генерирует RSA 2048
// и сохраняет туда (том переживает рестарт, поэтому токены не протухают).
func LoadOrCreateSigner(keyPath string, accessTTL, mfaTTL time.Duration) (*Signer, error) {
	if keyPath == "" {
		return nil, errors.New("JWT_KEY_PATH is empty")
	}

	var (
		priv *rsa.PrivateKey
		err  error
	)

	data, readErr := os.ReadFile(keyPath)
	switch {
	case readErr == nil:
		priv, err = parsePrivateKeyPEM(data)
		if err != nil {
			return nil, fmt.Errorf("parse key %s: %w", keyPath, err)
		}
	case errors.Is(readErr, os.ErrNotExist):
		priv, err = rsa.GenerateKey(rand.Reader, keyBits)
		if err != nil {
			return nil, fmt.Errorf("generate rsa key: %w", err)
		}
		if err := savePrivateKeyPEM(keyPath, priv); err != nil {
			return nil, fmt.Errorf("save key %s: %w", keyPath, err)
		}
	default:
		return nil, fmt.Errorf("read key %s: %w", keyPath, readErr)
	}

	kid, err := computeKID(&priv.PublicKey)
	if err != nil {
		return nil, err
	}

	return &Signer{priv: priv, kid: kid, accessTTL: accessTTL, mfaTTL: mfaTTL}, nil
}

// KID — идентификатор ключа (заголовок JWT и JWKS).
func (s *Signer) KID() string { return s.kid }

// AccessTTL — сколько живёт accessToken (нужен для поля expiresIn).
func (s *Signer) AccessTTL() time.Duration { return s.accessTTL }

// PublicKey — публичный ключ для JWKS.
func (s *Signer) PublicKey() *rsa.PublicKey { return &s.priv.PublicKey }

// NewMFAToken — короткоживущий токен шага 1. Другие сервисы его не принимают:
// в amr нет "otp".
func (s *Signer) NewMFAToken(userID int64, sessionID uuid.UUID) (string, error) {
	now := time.Now().UTC()
	claims := MFAClaims{
		Typ: typeMFA,
		Amr: []string{AmrPwd},
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    Issuer,
			Subject:   fmt.Sprintf("%d", userID),
			ID:        sessionID.String(),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.mfaTTL)),
		},
	}
	return s.sign(claims)
}

// NewAccessToken — финальный токен. Возвращает строку и момент истечения.
func (s *Signer) NewAccessToken(userID int64, email, name string, roles []string) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(s.accessTTL)
	claims := UserClaims{
		Email: email,
		Name:  name,
		Roles: roles,
		Amr:   []string{AmrPwd, AmrOTP},
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    Issuer,
			Subject:   fmt.Sprintf("%d", userID),
			ID:        uuid.NewString(),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	tok, err := s.sign(claims)
	return tok, exp, err
}

// ValidateAccessToken проверяет подпись, exp, iss и наличие "otp" в amr.
func (s *Signer) ValidateAccessToken(tokenStr string) (*UserClaims, error) {
	claims := &UserClaims{}
	if err := s.parse(tokenStr, claims); err != nil {
		return nil, err
	}
	if !contains(claims.Amr, AmrOTP) {
		return nil, errors.New(`amr must contain "otp"`)
	}
	if claims.Subject == "" {
		return nil, errors.New("missing sub")
	}
	return claims, nil
}

// ValidateMFAToken проверяет подпись, exp, iss и typ == "mfa".
func (s *Signer) ValidateMFAToken(tokenStr string) (*MFAClaims, error) {
	claims := &MFAClaims{}
	if err := s.parse(tokenStr, claims); err != nil {
		return nil, err
	}
	if claims.Typ != typeMFA {
		return nil, fmt.Errorf("bad token type %q", claims.Typ)
	}
	if claims.ID == "" {
		return nil, errors.New("missing jti")
	}
	return claims, nil
}

func (s *Signer) parse(tokenStr string, claims jwt.Claims) error {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{algRS256}),
		jwt.WithIssuer(Issuer),
		jwt.WithExpirationRequired(),
	)
	_, err := parser.ParseWithClaims(tokenStr, claims, func(*jwt.Token) (interface{}, error) {
		return s.PublicKey(), nil
	})
	return err
}

func (s *Signer) sign(claims jwt.Claims) (string, error) {
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = s.kid
	return tok.SignedString(s.priv)
}

// --- helpers ---

func parsePrivateKeyPEM(data []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, errors.New("no PEM block in key file")
	}
	if k, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return k, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	k, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("key file is not an RSA key")
	}
	return k, nil
}

func savePrivateKeyPEM(path string, k *rsa.PrivateKey) error {
	if dir := filepath.Dir(path); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	block := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(k)}
	return os.WriteFile(path, pem.EncodeToMemory(block), 0o600)
}

// computeKID — первые 16 символов base64url от SHA-256 публичного ключа в DER.
func computeKID(pub *rsa.PublicKey) (string, error) {
	der, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(der)
	s := base64.RawURLEncoding.EncodeToString(sum[:])
	if len(s) < kidLen {
		return s, nil
	}
	return s[:kidLen], nil
}

// Base64URLRaw — base64url без паддинга (для n/e в JWKS).
func Base64URLRaw(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func contains(list []string, x string) bool {
	for _, v := range list {
		if v == x {
			return true
		}
	}
	return false
}

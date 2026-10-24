package mfa

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

const demoSecret = "JBSWY3DPEHPK3PXP"

func codeFor(t *testing.T, secret string, at time.Time) string {
	t.Helper()
	code, err := totp.GenerateCodeCustom(secret, at, totp.ValidateOpts{
		Period: Period, Skew: 0, Digits: otp.DigitsSix, Algorithm: otp.AlgorithmSHA1,
	})
	if err != nil {
		t.Fatalf("GenerateCodeCustom: %v", err)
	}
	return code
}

func TestValidateCode_AcceptsCurrentCode(t *testing.T) {
	now := time.Now().UTC()
	if !ValidateCode(codeFor(t, demoSecret, now), demoSecret) {
		t.Fatal("current code must be accepted")
	}
}

// Часы телефона могут отставать на один шаг — skew=1 это допускает.
func TestValidateCode_AllowsNeighbourStep(t *testing.T) {
	now := time.Now().UTC()
	prev := codeFor(t, demoSecret, now.Add(-Period*time.Second))
	if !ValidateCode(prev, demoSecret) {
		t.Fatal("previous step code must be accepted with skew=1")
	}
}

func TestValidateCode_RejectsWrongCode(t *testing.T) {
	if ValidateCode("000000", demoSecret) {
		// Теоретически возможен совпадением — проверяем заведомо чужой секрет.
		t.Log("000000 happened to be valid for demo secret, skipped")
	}
	if ValidateCode(codeFor(t, demoSecret, time.Now().UTC()), "REJECTEDSECRET234567") {
		t.Fatal("code for another secret must be rejected")
	}
}

func TestValidateCode_RejectsBadFormat(t *testing.T) {
	valid := codeFor(t, demoSecret, time.Now().UTC())
	for _, bad := range []string{"", "12345", "1234567", "abcdef", "123a56", "1234 6"} {
		if ValidateCode(bad, demoSecret) {
			t.Errorf("code %q must be rejected", bad)
		}
	}
	_ = valid
}

func TestGenerateSecret_AndQR(t *testing.T) {
	key, err := GenerateSecret("demo@rt.ru")
	if err != nil {
		t.Fatalf("GenerateSecret: %v", err)
	}
	if key.Secret() == "" {
		t.Fatal("empty secret")
	}
	if !strings.Contains(key.URL(), "otpauth://totp/") {
		t.Fatalf("unexpected url %q", key.URL())
	}
	if !strings.Contains(key.URL(), "Radar%20RT") && !strings.Contains(key.URL(), "Radar RT") {
		t.Errorf("issuer missing in url %q", key.URL())
	}

	qr, err := QRBase64(key)
	if err != nil {
		t.Fatalf("QRBase64: %v", err)
	}
	raw, err := base64.StdEncoding.DecodeString(qr)
	if err != nil {
		t.Fatalf("qr is not base64: %v", err)
	}
	// PNG magic
	if len(raw) < 8 || string(raw[1:4]) != "PNG" {
		t.Fatalf("qr is not a PNG (len=%d)", len(raw))
	}
}

// Секрет, сохранённый при login, должен восстанавливаться для повторной выдачи QR.
func TestKeyFromSecret_RoundTrip(t *testing.T) {
	orig, err := GenerateSecret("admin@rt.ru")
	if err != nil {
		t.Fatalf("GenerateSecret: %v", err)
	}

	restored, err := KeyFromSecret(orig.Secret(), "admin@rt.ru")
	if err != nil {
		t.Fatalf("KeyFromSecret: %v", err)
	}
	if restored.Secret() != orig.Secret() {
		t.Fatalf("secret mismatch: %q != %q", restored.Secret(), orig.Secret())
	}

	now := time.Now().UTC()
	if !ValidateCode(codeFor(t, orig.Secret(), now), restored.Secret()) {
		t.Fatal("restored secret must validate the same codes")
	}
}

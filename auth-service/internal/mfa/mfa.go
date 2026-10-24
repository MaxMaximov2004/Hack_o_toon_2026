package mfa

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image/png"
	"net/url"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

const (
	Issuer = "Radar RT"
	Period = 30
	Skew   = 1
	QRSize = 200
)

// Key — псевдоним типа из библиотеки, чтобы не импортировать totp в handler.
type Key = otp.Key

// GenerateSecret создаёт новый TOTP-ключ (случайный секрет).
func GenerateSecret(accountName string) (*Key, error) {
	return totp.Generate(totp.GenerateOpts{
		Issuer:      Issuer,
		AccountName: accountName,
		Period:      Period,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
}

// KeyFromSecret восстанавливает ключ из уже сохранённого секрета — нужно,
// чтобы выдать QR пользователю, у которого секрет есть, но 2FA ещё не привязан.
func KeyFromSecret(secret, accountName string) (*Key, error) {
	return otp.NewKeyFromURL(buildURL(secret, accountName))
}

// buildURL — otpauth://totp/Issuer:account?secret=...&issuer=...&period=30
func buildURL(secret, accountName string) string {
	return fmt.Sprintf(
		"otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=%d",
		url.PathEscape(Issuer+":"+accountName),
		url.QueryEscape(secret),
		url.QueryEscape(Issuer),
		Period,
	)
}

// QRBase64 — PNG 200x200 в base64 без data:-префикса (фронт добавляет его сам).
func QRBase64(key *Key) (string, error) {
	img, err := key.Image(QRSize, QRSize)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// ValidateCode — проверка кода 2FA: ровно 6 цифр, SHA1, допуск соседнего шага.
func ValidateCode(code, secret string) bool {
	if len(code) != 6 || !isDigits(code) {
		return false
	}
	pass, err := totp.ValidateCustom(code, secret, time.Now().UTC(), totp.ValidateOpts{
		Period:    Period,
		Skew:      Skew,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	return err == nil && pass
}

func isDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}

#!/usr/bin/env bash
# =====================================================================
# Выпускает ТЕСТОВЫЙ accessToken (RS256, dev-ключ) — как после входа с 2FA.
#   bash contracts/dev-keys/mint-token.sh            # роль manager, 8 часов
#   bash contracts/dev-keys/mint-token.sh admin      # роли manager + admin
#   TTL=60 bash contracts/dev-keys/mint-token.sh     # срок жизни в секундах
#   NO_OTP=1 ...  -> amr без "otp"   (должен получить 401)
#   ISS=evil ...  -> чужой issuer    (должен получить 401)
#   TTL=-60 ...   -> уже истёкший    (должен получить 401)
#
# Пример:
#   TOKEN=$(bash contracts/dev-keys/mint-token.sh)
#   curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/companies
# =====================================================================
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROLE="${1:-manager}"
TTL="${TTL:-28800}"
ISS="${ISS:-radar-auth}"

case "$ROLE" in
  manager) sub=1; email="demo@rt.ru";  name="Демо Менеджер"; roles='["manager"]' ;;
  admin)   sub=2; email="admin@rt.ru"; name="Администратор"; roles='["manager","admin"]' ;;
  *) echo "роль: manager | admin" >&2; exit 1 ;;
esac
amr='["pwd","otp"]'; [ -n "${NO_OTP:-}" ] && amr='["pwd"]'

now=$(date +%s)
header='{"alg":"RS256","typ":"JWT","kid":"dev-1"}'
payload=$(printf '{"iss":"%s","sub":"%s","email":"%s","name":"%s","roles":%s,"amr":%s,"iat":%d,"exp":%d,"jti":"%s"}' \
  "$ISS" "$sub" "$email" "$name" "$roles" "$amr" "$now" "$((now + TTL))" "$(openssl rand -hex 16)")

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
unsigned="$(printf '%s' "$header" | b64url).$(printf '%s' "$payload" | b64url)"
sig=$(printf '%s' "$unsigned" | openssl dgst -sha256 -sign "$DIR/jwt-dev-private.pem" -binary | b64url)

echo "$unsigned.$sig"

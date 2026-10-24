#!/usr/bin/env bash
# =====================================================================
# Генерирует ТЕСТОВУЮ пару RSA и jwks.json для проверки JWT без auth-service.
#   bash contracts/dev-keys/gen-keys.sh
# Ключи уже лежат в репозитории — перегенерировать нужно, только если их потеряли.
# Только для разработки! Настоящий auth-service (Go) создаёт свой ключ,
# и токены, подписанные этим ключом, в полной сборке НЕ принимаются.
# Нужен только openssl (есть в Git Bash, macOS, Linux).
# =====================================================================
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
KID="dev-1"

openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$DIR/jwt-dev-private.pem" 2>/dev/null
openssl rsa -in "$DIR/jwt-dev-private.pem" -pubout -out "$DIR/jwt-dev-public.pem" 2>/dev/null

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
n=$(openssl rsa -in "$DIR/jwt-dev-private.pem" -noout -modulus | cut -d= -f2 | xxd -r -p | b64url)

printf '{"keys":[{"kty":"RSA","use":"sig","alg":"RS256","kid":"%s","n":"%s","e":"AQAB"}]}\n' "$KID" "$n" \
  > "$DIR/jwks.json"

echo "Готово: jwt-dev-private.pem, jwt-dev-public.pem, jwks.json (kid=$KID)"

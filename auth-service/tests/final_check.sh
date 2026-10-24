#!/bin/sh
# Финальная проверка auth-service. Использование: sh /tmp/final.sh <TOTP_CODE>
# Статус определяем по -S: busybox wget печатает статусную строку в stderr
# и при успехе, и при ошибке. Тело ответа — в /tmp/body.out.
BASE=http://localhost:8081
CODE="$1"
pass=0; fail=0

# status <method> <path> [bearer]  -> печатает HTTP-код; тело в /tmp/body.out
status() {
  _m="$1"; _p="$2"; _b="$3"
  if [ "$_m" = "POST" ]; then
    if [ -n "$_b" ]; then
      wget -S -O /tmp/body.out --header="Content-Type: application/json" --header="Authorization: Bearer $_b" --post-file=/tmp/req.json "$BASE$_p" 2>&1
    else
      wget -S -O /tmp/body.out --header="Content-Type: application/json" --post-file=/tmp/req.json "$BASE$_p" 2>&1
    fi
  else
    if [ -n "$_b" ]; then
      wget -S -O /tmp/body.out --header="Authorization: Bearer $_b" "$BASE$_p" 2>&1
    else
      wget -S -O /tmp/body.out "$BASE$_p" 2>&1
    fi
  fi | grep -oE 'HTTP/1\.[01] [0-9]{3}' | tail -1 | awk '{print $2}'
}

# check <label> <expected> <method> <path> [bearer]
check() {
  _label="$1"; _expect="$2"; shift 2
  _got=$(status "$@")
  if [ "$_got" = "$_expect" ]; then
    echo "PASS  $_label -> $_got"; pass=$((pass+1))
  else
    echo "FAIL  $_label -> got '$_got', want $_expect"; fail=$((fail+1))
  fi
}

body() { printf '%s' "$1" > /tmp/req.json; }

echo "--- health / jwks ---"
check "GET /health" 200 GET /health
check "GET /internal/auth/jwks" 200 GET /internal/auth/jwks

echo "--- login (шаг 1) ---"
body '{"email":"demo@rt.ru","password":"Demo2026!"}'
check "login demo" 200 POST /api/auth/login
body '{"email":"demo@rt.ru","password":"wrong"}'
check "login bad password" 401 POST /api/auth/login
body '{"email":"ghost@rt.ru","password":"whatever"}'
check "login unknown email" 401 POST /api/auth/login

body '{"email":"demo@rt.ru","password":"Demo2026!"}'
MFA=$(wget -q -O - --header="Content-Type: application/json" --post-file=/tmp/req.json $BASE/api/auth/login | sed 's/.*"mfaToken":"\([^"]*\)".*/\1/')

echo "--- 2fa verify (шаг 2) ---"
body "{\"mfaToken\":\"$MFA\",\"code\":\"12ab45\"}"
check "verify not-6-digits" 400 POST /api/auth/2fa/verify
body "{\"mfaToken\":\"$MFA\",\"code\":\"000000\"}"
check "verify wrong code" 401 POST /api/auth/2fa/verify
body '{"mfaToken":"garbage","code":"123456"}'
check "verify bad token" 401 POST /api/auth/2fa/verify

body "{\"mfaToken\":\"$MFA\",\"code\":\"$CODE\"}"
check "verify good code" 200 POST /api/auth/2fa/verify
AT=$(sed 's/.*"accessToken":"\([^"]*\)".*/\1/' /tmp/body.out)

echo "--- replay сожжённой сессии ---"
body "{\"mfaToken\":\"$MFA\",\"code\":\"$CODE\"}"
check "verify replay used session" 401 POST /api/auth/2fa/verify

echo "--- защищённые маршруты ---"
if [ -z "$AT" ]; then
  echo "FAIL  accessToken пуст — пропуск"; fail=$((fail+1))
else
  check "GET /me with accessToken" 200 GET /api/auth/me "$AT"
  check "GET /me with mfaToken" 401 GET /api/auth/me "$MFA"
  check "POST /register as manager" 403 POST /api/auth/register "$AT"
fi
check "GET /me anonymous" 401 GET /api/auth/me

echo ""
echo "accessToken length: ${#AT}"
echo "PASS=$pass FAIL=$fail"

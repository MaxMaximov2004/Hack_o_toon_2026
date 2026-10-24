#!/bin/sh
# Проверка, что привязка 2FA админа переживает рестарт контейнера.
#   sh /tmp/admin_2fa.sh            -> только логин: печатает setupRequired и секрет
#   sh /tmp/admin_2fa.sh <CODE>     -> логин + verify (привязка 2FA)
BASE=http://localhost:8081
CODE="$1"

printf '{"email":"admin@rt.ru","password":"Admin2026!"}' > /tmp/req.json
RESP=$(wget -q -O - --header="Content-Type: application/json" --post-file=/tmp/req.json $BASE/api/auth/login)

SETUP=$(echo "$RESP" | sed 's/.*"mfaSetupRequired":\(true\|false\).*/\1/')
SECRET=$(echo "$RESP" | sed 's/.*secret=\([A-Z2-7]*\).*/\1/')
MFA=$(echo "$RESP" | sed 's/.*"mfaToken":"\([^"]*\)".*/\1/')

echo "setupRequired=$SETUP"
echo "secret=$SECRET"

[ -z "$CODE" ] && exit 0

printf '{"mfaToken":"%s","code":"%s"}' "$MFA" "$CODE" > /tmp/req.json
OUT=$(wget -S -O /tmp/v.out --header="Content-Type: application/json" --post-file=/tmp/req.json $BASE/api/auth/2fa/verify 2>&1)
echo "verify=$(echo "$OUT" | grep -oE 'HTTP/1\.[01] [0-9]{3}' | tail -1 | awk '{print $2}')"
echo "roles=$(sed 's/.*"roles":\(\[[^]]*\]\).*/\1/' /tmp/v.out)"

#!/usr/bin/env bash
# =====================================================================
# Смоук-проверка сборки. Запускает техлид после docker compose up -d --build.
#   bash infra/smoke.sh            # продукт 1
#   PRODUCT2=1 bash infra/smoke.sh # + notifier
# Выход 0 = всё зелёное. Любая красная строка = кого-то звать.
# Нужны: bash (на Windows — Git Bash), curl, openssl; python — если нет,
# возьмётся из образа python:3.12-alpine.
# =====================================================================
set -u
BASE="${BASE:-http://localhost:${HTTP_PORT:-80}}"
PSQL="docker compose exec -T postgres psql -U postgres -d radar -At -c"
fail=0

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }
check(){ [ "$2" = "$3" ] && ok "$1 ($2)" || bad "$1: ожидали '$3', получили '$2'"; }

echo "1. Контейнеры"
for s in postgres etl auth-service core-api export-service nginx; do
  st=$(docker compose ps --format '{{.State}}' "$s" 2>/dev/null)
  check "$s запущен" "${st:-нет}" "running"
done
# ETL — сервис: грузит данные при старте. Ждём окончания загрузки (до ETL_WAIT секунд)
etl_run=""
for _ in $(seq 1 "${ETL_WAIT:-300}"); do
  etl_run=$($PSQL "select status from etl.load_run order by id desc limit 1" 2>/dev/null)
  [ "$etl_run" = ok ] || [ "$etl_run" = failed ] && break
  sleep 1
done
check "загрузка ETL (etl.load_run)" "${etl_run:-нет запусков}" "ok"
[ "$etl_run" = ok ] || echo "  детали: $($PSQL "select details from etl.load_run order by id desc limit 1" 2>/dev/null) — docker compose logs etl"
stub=$(docker ps --filter 'name=^radar-auth-stub$' --format '{{.State}}' 2>/dev/null)
[ -z "$stub" ] && ok "auth-stub не запущен" || bad "auth-stub запущен — подменяет auth-service: docker compose --profile auth-stub down"

echo "2. Здоровье сервисов через nginx"
svcs="auth core export"; [ -n "${PRODUCT2:-}" ] && svcs="$svcs notifier"
for s in $svcs; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/healthz/$s")
  check "/healthz/$s" "$code" "200"
done
check "/internal закрыт снаружи" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/internal/companies")" "404"
check "фронт отдаётся" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")" "200"
check "API без токена -> 401" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/companies")" "401"

echo "3. Данные (ETL)"
check "клиентов РТ в сиде (etl.raw_clients)" "$($PSQL 'select count(*) from etl.raw_clients')" "759"
check "клиентов РТ в core.company"            "$($PSQL 'select count(*) from core.company where is_client')" "759"
rmsp=$($PSQL 'select count(*) from etl.raw_rmsp')
[ "${rmsp:-0}" -gt 1000 ] && ok "реестр МСП загружен: $rmsp строк" || bad "реестр МСП не загружен (etl.raw_rmsp = ${rmsp:-0}) — см. docs/data/rmsp-instruction.md"
others=$($PSQL "select count(*) from core.company where not is_client and status='active'")
[ "${others:-0}" -gt 1000 ] && ok "потенциальных клиентов: $others" || bad "потенциальных клиентов мало: ${others:-0}"
echo "  статусы клиентов: $($PSQL "select string_agg(status||'='||n, ', ') from (select status, count(*) n from core.company where is_client group by 1) t")"
check "компаний без координат"       "$($PSQL 'select count(*) from core.company where lat is null or lon is null')" "0"
spots=$($PSQL "select count(*) from core.municipality_stats where industry='all' and is_white_spot")
[ "${spots:-0}" -ge 1 ] && ok "белых пятен: $spots" || bad "белых пятен нет"

echo "4. Изоляция схем"
deny(){ out=$(docker compose exec -T postgres psql -U "$1" -d radar -c "$2" 2>&1)
        echo "$out" | grep -q "permission denied" && ok "$1 не видит: $2" || bad "$1 ВИДИТ чужое: $2"; }
deny core_svc   "select 1 from auth.users limit 1"
deny auth_svc   "select 1 from core.company limit 1"
deny etl_loader "create table core.hack(x int)"
deny calc_svc   "select 1 from core.company limit 1"

echo "5. Демо-сценарий через nginx: вход с 2FA, API, экспорт"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
# python — для TOTP и разбора JSON: с хоста, а если его нет — из контейнера
py(){ for p in python3 python; do
        if command -v "$p" >/dev/null 2>&1 && "$p" -c '' >/dev/null 2>&1; then "$p" -I -X utf8 "$@"; return; fi
      done
      docker run --rm -i python:3.12-alpine python -I -X utf8 "$@"; }
# json <поле> < ответ  ->  значение (вложенные — через точку: user.email)
json(){ py -c 'import json,sys
v=json.load(sys.stdin.buffer)
for k in sys.argv[1].split("."): v=v[int(k)] if isinstance(v,list) else v[k]
print(v)' "$1" 2>/dev/null; }
totp(){ py -c 'import base64,hmac,hashlib,struct,sys,time
h=hmac.new(base64.b32decode(sys.argv[1]),struct.pack(">Q",int(time.time())//30),hashlib.sha1).digest()
o=h[-1]&15; print("%06d"%((struct.unpack(">I",h[o:o+4])[0]&0x7fffffff)%1000000))' "$1"; }
# req МЕТОД ПУТЬ [JSON-тело]  ->  $CODE и $BODY; токен берётся из $AUTH
req(){ local a=(-s -w '\n%{http_code}' -X "$1" "$BASE$2") out
       [ -n "${AUTH:-}" ] && a+=(-H "Authorization: Bearer $AUTH")
       [ -n "${3:-}" ] && a+=(-H 'Content-Type: application/json' --data "$3")
       out=$(curl "${a[@]}"); CODE=${out##*$'\n'}; BODY=${out%$'\n'*}; }

DEMO_EMAIL="${DEMO_USER_EMAIL:-demo@rt.ru}"
DEMO_PASSWORD="${DEMO_USER_PASSWORD:-Demo2026!}"
DEMO_SECRET="${DEMO_TOTP_SECRET:-JBSWY3DPEHPK3PXP}"
AUTH=""

req POST /api/auth/login "{\"email\":\"$DEMO_EMAIL\",\"password\":\"wrong-password\"}"
check "неверный пароль -> 401" "$CODE" "401"
req POST /api/auth/login "{\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}"
check "вход $DEMO_EMAIL" "$CODE" "200"
mfa=$(json mfaToken <<<"$BODY")
if [ -n "$mfa" ]; then
  [ $(( $(date +%s) % 30 )) -ge 27 ] && sleep 4     # не попасть на смену 30-секундного окна TOTP
  req POST /api/auth/2fa/verify "{\"mfaToken\":\"$mfa\",\"code\":\"$(totp "$DEMO_SECRET")\"}"
  check "2FA, код из секрета демо" "$CODE" "200"
  AUTH=$(json accessToken <<<"$BODY")
fi

if [ -z "$AUTH" ]; then
  bad "accessToken не получен — проверки API с токеном пропущены (docker compose logs auth-service)"
else
  req GET /api/auth/me;                               check "/api/auth/me"            "$CODE" "200"
  req GET /api/dictionaries;                          check "/api/dictionaries"       "$CODE" "200"
  req GET "/api/map/cells?zoom=7";                    check "/api/map/cells, вся область" "$CODE" "200"
  req GET "/api/municipalities/stats?industry=all";   check "/api/municipalities/stats" "$CODE" "200"
  req GET "/api/white-spots?industry=all&limit=10";   check "/api/white-spots"        "$CODE" "200"
  req GET "/api/companies?size=1";                    check "/api/companies"          "$CODE" "200"
  total=$(json total <<<"$BODY")
  [ "${total:-0}" -gt 0 ] 2>/dev/null && ok "компаний в API: $total" || bad "/api/companies пустой: total=${total:-нет}"

  # экспорт «ровно то, что на экране»: строк в файле столько же, сколько total у списка с тем же фильтром
  f="client=ours&status=all"
  req GET "/api/companies?$f&size=1"; listed=$(json total <<<"$BODY")
  code=$(curl -s -D "$TMP/h" -o "$TMP/export.csv" -w '%{http_code}' \
         -H "Authorization: Bearer $AUTH" "$BASE/api/export/companies?$f&format=bitrix")
  check "экспорт в Bitrix24" "$code" "200"
  grep -qi '^content-disposition:.*filename' "$TMP/h" && ok "у экспорта есть имя файла" \
    || bad "в ответе экспорта нет Content-Disposition с filename"
  rows=$(py -c 'import csv,sys
f=open(sys.argv[1],encoding="utf-8-sig",newline=""); head=f.readline(); f.seek(0)
d=";" if head.count(";")>=head.count(",") else ","          # разделитель — по заголовку
print(sum(1 for r in csv.reader(f,delimiter=d) if r)-1)' "$TMP/export.csv" 2>/dev/null)
  check "строк в экспорте = в списке ($f)" "${rows:-нет}" "${listed:-нет}"

  # токен, подписанный тестовым ключом из contracts/dev-keys, в настоящей сборке недействителен
  AUTH=$(bash "$ROOT/contracts/dev-keys/mint-token.sh")
  req GET "/api/companies?size=1"; check "core-api отклоняет dev-токен"   "$CODE" "401"
  req GET "/api/export/companies?$f&format=csv"; check "export отклоняет dev-токен" "$CODE" "401"
fi

echo
[ $fail = 0 ] && echo "ВСЁ ЗЕЛЁНОЕ" || { echo "ЕСТЬ ОШИБКИ — см. FAIL выше, логи: docker compose logs <сервис>"; exit 1; }

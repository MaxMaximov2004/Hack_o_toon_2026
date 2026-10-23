#!/usr/bin/env bash
# =====================================================================
# Смоук-проверка сборки. Запускает техлид после docker compose up -d --build.
#   bash infra/smoke.sh            # продукт 1
#   PRODUCT2=1 bash infra/smoke.sh # + notifier
# Выход 0 = всё зелёное. Любая красная строка = кого-то звать.
# =====================================================================
set -u
BASE="${BASE:-http://localhost:${HTTP_PORT:-80}}"
PSQL="docker compose exec -T postgres psql -U postgres -d radar -At -c"
fail=0

ok()   { printf '  \033[32mOK\033[0m   %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=1; }
check(){ [ "$2" = "$3" ] && ok "$1 ($2)" || bad "$1: ожидали '$3', получили '$2'"; }

echo "1. Контейнеры"
for s in postgres auth-service core-api export-service nginx; do
  st=$(docker compose ps --format '{{.State}}' "$s" 2>/dev/null)
  check "$s запущен" "${st:-нет}" "running"
done
etl_exit=$(docker compose ps -a --format '{{.ExitCode}}' etl 2>/dev/null)
check "etl завершился успешно" "${etl_exit:-нет}" "0"

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

echo
[ $fail = 0 ] && echo "ВСЁ ЗЕЛЁНОЕ" || { echo "ЕСТЬ ОШИБКИ — см. FAIL выше, логи: docker compose logs <сервис>"; exit 1; }

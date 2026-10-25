#!/usr/bin/env bash
# =====================================================================
# Обновить сервер до свежей версии текущей ветки (main или та, что указана
# в setup-server.sh через BRANCH) и перезапустить:
#   bash /opt/radar/infra/deploy/update.sh
#   RESET=1 bash /opt/radar/infra/deploy/update.sh   # с пересозданием БД
#                                                    # (после правок infra/db/init)
# Поднимает только те сервисы, чьи папки уже есть в main. Пока нет
# auth-service — вместо него auth-stub (вход с ЛЮБЫМ паролем). Ведёт: техлид.
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."

git pull -q --ff-only

services="postgres nginx"
for s in etl core-api auth-service export-service calc-service; do
  [ -f "$s/Dockerfile" ] && services="$services $s"
done
# notifier (продукт 2) — в профиле product2; без него --remove-orphans снёс бы контейнер
extra=""
if [ -f notifier/Dockerfile ]; then
  services="$services notifier"
  extra="--profile product2"
fi

if [ -f auth-service/Dockerfile ]; then
  docker compose --profile auth-stub rm -sf auth-stub >/dev/null 2>&1 || true
  profile="$extra"
else
  services="$services auth-stub"
  profile="--profile auth-stub $extra"
  echo "ВНИМАНИЕ: auth-service ещё нет — вход через auth-stub (любой пароль и код)"
fi

if [ -n "${RESET:-}" ]; then
  docker compose --profile auth-stub --profile product2 down -v
fi

echo "Сервисы: $services"
docker compose $profile up -d --build --remove-orphans $services
docker image prune -f >/dev/null

docker compose $profile ps --format 'table {{.Name}}\t{{.Status}}'
echo
echo "Готово: http://$(curl -s -4 --max-time 3 ifconfig.me || hostname -I | cut -d' ' -f1)"
echo "Проверка: bash infra/smoke.sh   (ETL грузит данные ~2 мин после первого старта)"

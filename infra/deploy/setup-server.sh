#!/usr/bin/env bash
# =====================================================================
# Первичная настройка сервера (Ubuntu / Debian). Один раз, от root:
#   bash setup-server.sh
#   BRANCH=before-main bash setup-server.sh     # развернуть не main, а другую ветку
# Можно запускать повторно — уже сделанные шаги пропускаются.
#
# Что делает: ставит git и Docker, добавляет swap (сборка Java и фронта
# требует памяти), создаёт deploy-ключ для приватного репозитория, клонирует
# его в /opt/radar, генерирует .env со случайными паролями и запускает
# infra/deploy/update.sh. Ведёт: техлид.
# =====================================================================
set -euo pipefail
REPO="${REPO:-git@github.com:MaxMaximov2004/Hack_o_toon_2026.git}"
DIR="${DIR:-/opt/radar}"
BRANCH="${BRANCH:-main}"
KEY=/root/.ssh/radar_deploy

[ "$(id -u)" = 0 ] || { echo "Запускать от root"; exit 1; }

echo "== 1. Пакеты"
apt-get update -qq
apt-get install -y -qq git curl ca-certificates openssl >/dev/null

echo "== 2. Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh \
    || apt-get install -y -qq docker.io docker-compose-v2      # если download.docker.com недоступен
fi
# Зеркало Docker Hub: из РФ hub.docker.com часто недоступен
if [ ! -f /etc/docker/daemon.json ]; then
  mkdir -p /etc/docker
  echo '{ "registry-mirrors": ["https://mirror.gcr.io"] }' > /etc/docker/daemon.json
  systemctl restart docker
fi
docker compose version >/dev/null || { echo "Нет docker compose v2"; exit 1; }

echo "== 3. Swap"
if [ "$(swapon --show | wc -l)" = 0 ] && [ "$(free -m | awk '/Mem:/ {print $2}')" -lt 7000 ]; then
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  swap 4 ГБ добавлен"
fi

echo "== 4. Доступ к репозиторию"
if [ ! -f "$KEY" ]; then
  mkdir -p /root/.ssh && chmod 700 /root/.ssh
  ssh-keygen -q -t ed25519 -N "" -C "radar-deploy@$(hostname)" -f "$KEY"
  printf 'Host github.com\n  IdentityFile %s\n  IdentitiesOnly yes\n' "$KEY" >> /root/.ssh/config
  ssh-keyscan -q github.com >> /root/.ssh/known_hosts 2>/dev/null
fi
if [ ! -d "$DIR/.git" ]; then
  if ! git clone -q -b "$BRANCH" "$REPO" "$DIR" 2>/dev/null; then
    echo
    echo "Нет доступа к репозиторию. Владелец репозитория на GitHub должен добавить ключ:"
    echo "  Settings -> Deploy keys -> Add deploy key (Allow write access — НЕ ставить)"
    echo
    cat "$KEY.pub"
    echo
    echo "Потом запустить этот скрипт ещё раз."
    exit 1
  fi
fi

echo "== 5. .env"
if [ ! -f "$DIR/.env" ]; then
  pw() { openssl rand -hex 16; }
  cat > "$DIR/.env" <<EOF
# Создан setup-server.sh $(date +%F). Пароли БД случайные; база наружу не открыта.
HTTP_PORT=80
POSTGRES_PASSWORD=$(pw)
AUTH_DB_PASSWORD=$(pw)
CORE_DB_PASSWORD=$(pw)
ETL_DB_PASSWORD=$(pw)
NOTIFY_DB_PASSWORD=$(pw)
CALC_DB_PASSWORD=$(pw)
INTERNAL_TOKEN=$(pw)
# Демо-доступ для жюри — как в README
DEMO_USER_EMAIL=demo@rt.ru
DEMO_USER_PASSWORD=Demo2026!
DEMO_TOTP_SECRET=JBSWY3DPEHPK3PXP
ADMIN_USER_EMAIL=admin@rt.ru
ADMIN_USER_PASSWORD=Admin2026!
TELEGRAM_BOT_TOKEN=
EOF
  chmod 600 "$DIR/.env"
fi

echo "== 6. Запуск"
bash "$DIR/infra/deploy/update.sh"

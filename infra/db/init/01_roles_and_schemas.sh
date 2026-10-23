#!/bin/bash
# =====================================================================
# 01 — ПОЛЬЗОВАТЕЛИ БД И СХЕМЫ.
# Выполняется контейнером postgres ОДИН раз — при первом старте с пустым
# томом. Чтобы прогнать заново: docker compose down -v && docker compose up -d
#
# Правило: один сервис = одна схема = один пользователь БД.
# В чужую схему сервис не ходит — только HTTP к её владельцу.
# Пароли берутся из окружения (.env), у каждого есть dev-значение по умолчанию.
# =====================================================================
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v db="$POSTGRES_DB" \
  -v auth_pw="${AUTH_DB_PASSWORD:-auth_dev}" \
  -v core_pw="${CORE_DB_PASSWORD:-core_dev}" \
  -v etl_pw="${ETL_DB_PASSWORD:-etl_dev}" \
  -v notify_pw="${NOTIFY_DB_PASSWORD:-notify_dev}" \
  -v calc_pw="${CALC_DB_PASSWORD:-calc_dev}" <<'SQL'

-- Никто, кроме суперпользователя, не создаёт объекты в public
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;

-- ---------------------------------------------------------------------
-- Go — auth-service: вход, 2FA (TOTP), выдача JWT
-- ---------------------------------------------------------------------
CREATE ROLE auth_svc LOGIN PASSWORD :'auth_pw';
COMMENT ON ROLE auth_svc IS 'Go — auth-service (вход, 2FA, JWT). Владелец схемы auth. Ответственный: Go-разработчик';
CREATE SCHEMA auth AUTHORIZATION auth_svc;
COMMENT ON SCHEMA auth IS 'Go — auth-service: пользователи, хэши паролей, TOTP-секреты';

-- ---------------------------------------------------------------------
-- Java — core-api: радар (продукт 1) и навигатор (продукт 2)
-- ---------------------------------------------------------------------
CREATE ROLE core_svc LOGIN PASSWORD :'core_pw';
COMMENT ON ROLE core_svc IS 'Java — core-api (радар, навигатор). Владелец схемы core. Ответственные: Java #1, Java #2';
CREATE SCHEMA core AUTHORIZATION core_svc;
COMMENT ON SCHEMA core IS 'Java — core-api: районы, компании, статистика, инвестпроекты. Данные заливает ETL (Python)';

-- ---------------------------------------------------------------------
-- Python — ETL: сырые данные кейса + загрузка нормализованных данных в core
-- ---------------------------------------------------------------------
CREATE ROLE etl_loader LOGIN PASSWORD :'etl_pw';
COMMENT ON ROLE etl_loader IS 'Python — ETL. Владелец схемы etl (сырые данные). В core — только DML, без DDL (единственное исключение из правила схем). Ответственный: Python-разработчик';
CREATE SCHEMA etl AUTHORIZATION etl_loader;
COMMENT ON SCHEMA etl IS 'Python — ETL: сырая копия листов xlsx кейса, журнал загрузок';

-- ---------------------------------------------------------------------
-- Go — notifier: подписки и уведомления (продукт 2)
-- ---------------------------------------------------------------------
CREATE ROLE notify_svc LOGIN PASSWORD :'notify_pw';
COMMENT ON ROLE notify_svc IS 'Go — notifier (подписки, Telegram), продукт 2. Владелец схемы notify. Ответственный: Go-разработчик';
CREATE SCHEMA notify AUTHORIZATION notify_svc;
COMMENT ON SCHEMA notify IS 'Go — notifier: подписки, лента уведомлений, привязки Telegram (продукт 2)';

-- ---------------------------------------------------------------------
-- C# — export-service, калькулятор сделок (резерв, модуль 3)
-- ---------------------------------------------------------------------
CREATE ROLE calc_svc LOGIN PASSWORD :'calc_pw';
COMMENT ON ROLE calc_svc IS 'C# — export-service, калькулятор сделок (резерв). Владелец схемы calc. Ответственный: C#-разработчик';
CREATE SCHEMA calc AUTHORIZATION calc_svc;
COMMENT ON SCHEMA calc IS 'C# — калькулятор сделок (модуль 3, резерв): коэффициенты и цены из листов МОД3';

-- Право подключаться к БД — только нашим сервисам
GRANT CONNECT ON DATABASE :"db" TO auth_svc, core_svc, etl_loader, notify_svc, calc_svc;

-- Каждый видит только свою схему
ALTER ROLE auth_svc   SET search_path = auth;
ALTER ROLE core_svc   SET search_path = core;
ALTER ROLE etl_loader SET search_path = etl, core;
ALTER ROLE notify_svc SET search_path = notify;
ALTER ROLE calc_svc   SET search_path = calc;
SQL

echo "01_roles_and_schemas: роли и схемы созданы"

-- =====================================================================
-- 02 — ПЕРВАЯ МИГРАЦИЯ: ВСЕ ТАБЛИЦЫ ВСЕХ СЕРВИСОВ.
-- Каждый блок выполняется от имени роли-владельца (SET ROLE), поэтому
-- таблицы сразу принадлежат своему сервису.
-- Менять структуру — только через PR техлиду: правка здесь или новый файл
-- 05_*.sql, затем у всех docker compose down -v && docker compose up -d.
-- =====================================================================

-- =====================================================================
-- Go — auth-service (схема auth)
-- =====================================================================
SET ROLE auth_svc;

CREATE TABLE auth.users (
    id               bigserial PRIMARY KEY,
    email            text        NOT NULL UNIQUE,
    password_hash    text        NOT NULL,                       -- bcrypt
    full_name        text        NOT NULL,
    roles            text[]      NOT NULL DEFAULT '{manager}',   -- manager | admin
    totp_secret      text,                                       -- base32, NULL до первой привязки
    totp_enabled     boolean     NOT NULL DEFAULT false,
    created_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE auth.users IS 'Go — пользователи. Демо-пользователей создаёт auth-service при старте из .env';

CREATE TABLE auth.mfa_sessions (
    id          uuid        PRIMARY KEY,                         -- jti из mfaToken
    user_id     bigint      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attempts    int         NOT NULL DEFAULT 0,                  -- неверных кодов
    used        boolean     NOT NULL DEFAULT false,
    expires_at  timestamptz NOT NULL
);
COMMENT ON TABLE auth.mfa_sessions IS 'Go — шаг 2FA: счётчик попыток по mfaToken (5 неверных кодов -> сессия сгорает)';

RESET ROLE;

-- =====================================================================
-- Python — ETL (схема etl): сырая копия xlsx кейса
-- =====================================================================
SET ROLE etl_loader;

CREATE TABLE etl.raw_clients (               -- лист МОД1_Таб1 кейса = КЛИЕНТЫ Ростелекома, всё текстом как в xlsx
    src_no        text, name text, subject_type text, category text, ogrn text, inn text,
    okved         text, region text, district text, city text, settlement text,
    is_new        text, included_at text, excluded_at text, phone text, email text, website text,
    has_licenses  text, innovative text, partnership text, social text, employees text
);
COMMENT ON TABLE etl.raw_clients IS 'Python — клиенты Ростелекома из таблицы кейса (сид, 759). По словам куратора, среди них есть закрывшиеся и исключённые из реестра';

CREATE TABLE etl.raw_rmsp (                  -- выгрузка rmsp.nalog.ru по Ростовской области = ВЕСЬ РЫНОК
    src_no        text, name text, subject_type text, category text, ogrn text, inn text,
    okved         text, region text, district text, city text, settlement text,
    is_new        text, included_at text, excluded_at text, phone text, email text, website text,
    has_licenses  text, innovative text, partnership text, social text, employees text,
    source_file   text,                      -- из какого файла выгрузки строка
    is_excluded   boolean NOT NULL DEFAULT false   -- true = строка из выгрузки ИСКЛЮЧЁННЫХ из реестра
);
CREATE INDEX raw_rmsp_inn_idx ON etl.raw_rmsp (inn);
COMMENT ON TABLE etl.raw_rmsp IS 'Python — выгрузка реестра МСП ФНС (rmsp.nalog.ru), Ростовская обл. Заливает ETL из etl/data/rmsp_61.csv.gz';

CREATE TABLE etl.raw_revenue (               -- необязательно: доходы ЮЛ из открытых данных ФНС (бухотчётность)
    inn      text    NOT NULL,
    year     int     NOT NULL,
    income   numeric(18, 2),
    expense  numeric(18, 2),
    PRIMARY KEY (inn, year)
);
COMMENT ON TABLE etl.raw_revenue IS 'Python — доходы/расходы юрлиц из открытых данных ФНС, если удастся скачать. Иначе пусто и выручка моделируется';

CREATE TABLE etl.raw_invest (                -- лист МОД"_Таб1, инвестпроекты
    src_no text, municipality text, curator text, is_key text, initiator text, title text,
    start_year text, launch_year text, amount_mln text, jobs text
);
COMMENT ON TABLE etl.raw_invest IS 'Python — сырая копия листа МОД2 (сид, продукт 2)';

CREATE TABLE etl.load_run (
    id           bigserial PRIMARY KEY,
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    status       text        NOT NULL DEFAULT 'running',         -- running | ok | failed
    details      jsonb
);
COMMENT ON TABLE etl.load_run IS 'Python — журнал запусков ETL';

RESET ROLE;

-- =====================================================================
-- Java — core-api (схема core). Данные заливает ETL под etl_loader.
-- =====================================================================
SET ROLE core_svc;

CREATE TABLE core.municipality (
    id    serial PRIMARY KEY,
    name  text   NOT NULL UNIQUE,                                -- 'Аксайский р-н', 'г. Таганрог'
    kind  text   NOT NULL CHECK (kind IN ('district', 'city')),
    lat   double precision NOT NULL,
    lon   double precision NOT NULL
);
COMMENT ON TABLE core.municipality IS 'Java/Python — справочник муниципалитетов с центроидами';

CREATE TABLE core.company (
    id                  serial PRIMARY KEY,
    inn                 text    NOT NULL UNIQUE,
    ogrn                text,
    name                text    NOT NULL,
    subject_type        text    NOT NULL CHECK (subject_type IN ('ip', 'legal')),
    size_category       text    NOT NULL CHECK (size_category IN ('micro', 'small', 'medium')),
    okved_code          text,
    okved_name          text,
    industry            text    NOT NULL,                        -- код отрасли, см. контракт
    municipality_id     int     NOT NULL REFERENCES core.municipality(id),
    settlement          text,
    lat                 double precision NOT NULL,
    lon                 double precision NOT NULL,
    registered_at       date,
    is_new              boolean NOT NULL DEFAULT false,
    employees           int,
    phone               text,
    email               text,
    website             text,
    has_licenses        boolean NOT NULL DEFAULT false,
    is_innovative       boolean NOT NULL DEFAULT false,
    is_social           boolean NOT NULL DEFAULT false,
    revenue_est         numeric(16, 2),                          -- выручка, руб/год (ФНС или модель)
    revenue_growth_est  numeric(6, 2),                           -- рост, % год к году (ФНС или модель)
    revenue_source      text    CHECK (revenue_source IN ('fns', 'model')),
    is_estimated        boolean NOT NULL DEFAULT true,           -- true, если revenue_source = 'model'
    is_client           boolean NOT NULL DEFAULT false,          -- есть в списке клиентов Ростелекома
    status              text    NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'excluded')),  -- excluded = нет в действующем реестре МСП
    excluded_at         date,                                    -- дата исключения, если известна
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_municipality_idx ON core.company (municipality_id);
CREATE INDEX company_industry_idx     ON core.company (industry);
CREATE INDEX company_client_idx       ON core.company (is_client, status);
CREATE INDEX company_geo_idx          ON core.company (lat, lon);
COMMENT ON TABLE core.company IS 'Java — весь рынок: клиенты РТ (из кейса) + остальной реестр МСП Ростовской обл. Заполняет ETL';

CREATE TABLE core.company_location (
    id               bigserial PRIMARY KEY,
    inn              text    NOT NULL,                         -- по ИНН, без FK: ETL пересоздаёт company, а ручные адреса должны пережить перезагрузку
    kind             text    NOT NULL CHECK (kind IN ('registered', 'actual')),
    municipality_name text,                                    -- по имени, не id: справочник районов тоже пересоздаётся ETL
    region_name      text,                                     -- если за пределами области
    address          text,
    lat              double precision,
    lon              double precision,
    source           text    NOT NULL,                         -- crm | manager | egrul | zakupki | licenses | maps ...
    confidence       numeric(3, 2) NOT NULL DEFAULT 0.5,       -- 0..1
    note             text,
    created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX company_location_inn_idx ON core.company_location (inn);
COMMENT ON TABLE core.company_location IS 'Java/Python — задача со *: место регистрации и фактические места ведения бизнеса (несколько на компанию)';

CREATE TABLE core.municipality_stats (
    municipality_id   int     NOT NULL REFERENCES core.municipality(id),
    industry          text    NOT NULL DEFAULT 'all',            -- код отрасли или 'all'
    companies         int     NOT NULL,                        -- действующие (status = 'active')
    clients           int     NOT NULL,                        -- действующие клиенты РТ
    excluded_clients  int     NOT NULL DEFAULT 0,              -- клиенты РТ, исключённые из реестра
    new_share         numeric(5, 4) NOT NULL,                    -- 0..1
    revenue_est_sum   numeric(18, 2),
    base_score        numeric(5, 2) NOT NULL,                    -- 0..100, потенциал без учёта клиентов (считает ETL)
    potential_score   numeric(5, 2) NOT NULL,                    -- base_score * (1 - clients/companies)
    is_white_spot     boolean NOT NULL,
    reason            text,
    PRIMARY KEY (municipality_id, industry)
);
COMMENT ON TABLE core.municipality_stats IS 'Java — агрегаты и потенциал районов (продукт 1). Считает ETL';

CREATE TABLE core.invest_project (
    id                 serial PRIMARY KEY,
    municipality_id    int     NOT NULL REFERENCES core.municipality(id),
    initiator          text,
    title              text    NOT NULL,
    is_key             boolean NOT NULL DEFAULT false,
    curator            text,
    start_year         int,
    launch_year        int,
    amount_mln         numeric(12, 2),
    jobs               int,
    stage              text    CHECK (stage IN ('design', 'construction', 'launch')),
    industry           text,
    needs              text[]  NOT NULL DEFAULT '{}',            -- it_infra | apcs | phys_security | info_security
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invest_project_updated_idx ON core.invest_project (updated_at);
COMMENT ON TABLE core.invest_project IS 'Java — инвестпроекты (продукт 2). Заполняет ETL';

-- ---------------------------------------------------------------------
-- Формула потенциала районов и белых пятен — ОДНО место для Python и Java.
-- Вызывают: ETL после загрузки (etl_loader), core-api после импорта клиентов (core_svc).
--   SELECT core.refresh_municipality_stats();            -- порог 50, минимум 30 компаний
--   SELECT core.refresh_municipality_stats(60, 20);      -- калибровка порога
-- Порог 50 откалиброван на реальном реестре (188 тыс. компаний, охват РТ ~0,4% почти везде):
-- при 65 на общей карте белых пятен 0, при 50 — 3 (Целинский р-н, Багаевский р-н, г. Донецк).
-- Возвращает число белых пятен для industry = 'all'. Менять формулу — PR техлиду.
--
-- base_score  = 100 * (0.5*pr(компаний) + 0.3*pr(доли новых) + 0.2*pr(выручки)), pr — процентиль среди районов
-- gap         = 1 - охват_района / охват_по_области  (0, если охват выше среднего)
-- potential   = base_score * gap
-- белое пятно = gap >= 0.5 (охват вдвое ниже среднего) И base_score >= порог И компаний >= минимум
-- ---------------------------------------------------------------------
CREATE FUNCTION core.refresh_municipality_stats(p_threshold numeric DEFAULT 50, p_min_companies int DEFAULT 30)
RETURNS int LANGUAGE sql AS $$
TRUNCATE core.municipality_stats;
INSERT INTO core.municipality_stats
  (municipality_id, industry, companies, clients, excluded_clients, new_share, revenue_est_sum,
   base_score, potential_score, is_white_spot, reason)
WITH base AS (
  SELECT c.municipality_id, i.industry,
         count(*) FILTER (WHERE c.status = 'active')                   AS companies,
         count(*) FILTER (WHERE c.status = 'active' AND c.is_client)   AS clients,
         count(*) FILTER (WHERE c.status = 'excluded' AND c.is_client) AS excluded_clients,
         avg(c.is_new::int) FILTER (WHERE c.status = 'active')          AS new_share,
         sum(c.revenue_est) FILTER (WHERE c.status = 'active')          AS revenue_sum
  FROM core.company c CROSS JOIN LATERAL (VALUES (c.industry), ('all')) i(industry)
  GROUP BY 1, 2
), ranked AS (
  SELECT b.*,
         100 * (0.5 * percent_rank() OVER w_cnt + 0.3 * percent_rank() OVER w_new + 0.2 * percent_rank() OVER w_rev) AS base_score,
         sum(clients) OVER (PARTITION BY industry)::numeric / nullif(sum(companies) OVER (PARTITION BY industry), 0) AS regional_cov
  FROM base b WHERE companies > 0
  WINDOW w_cnt AS (PARTITION BY industry ORDER BY companies),
         w_new AS (PARTITION BY industry ORDER BY new_share),
         w_rev AS (PARTITION BY industry ORDER BY revenue_sum NULLS FIRST)
), scored AS (
  SELECT r.*,
         CASE WHEN coalesce(regional_cov, 0) = 0 THEN 1
              ELSE greatest(0, 1 - (clients::numeric / companies) / regional_cov) END AS gap
  FROM ranked r
)
SELECT municipality_id, industry, companies, clients, excluded_clients,
       round(coalesce(new_share, 0), 4), revenue_sum,
       round(base_score::numeric, 2), round((base_score * gap)::numeric, 2),
       (gap >= 0.5 AND base_score >= p_threshold AND companies >= p_min_companies),
       CASE WHEN gap >= 0.5 AND base_score >= p_threshold AND companies >= p_min_companies THEN
         companies || ' компаний, охват РТ ' || round(100.0 * clients / companies, 2)
         || '% при среднем по области ' || round(100 * coalesce(regional_cov, 0), 2) || '%'
       END
FROM scored;
SELECT count(*)::int FROM core.municipality_stats WHERE industry = 'all' AND is_white_spot;
$$;
COMMENT ON FUNCTION core.refresh_municipality_stats(numeric, int) IS 'Java/Python — пересчёт потенциала районов и белых пятен (единая формула)';

CREATE TABLE core.need_offer (
    need    text   PRIMARY KEY,
    offers  text[] NOT NULL
);
COMMENT ON TABLE core.need_offer IS 'Java #2 — потребность -> предложения Ростелекома (продукт 2)';

RESET ROLE;

-- Исключение: ETL пишет данные в core (только DML, без DDL)
GRANT USAGE ON SCHEMA core TO etl_loader;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA core TO etl_loader;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA core TO etl_loader;
ALTER DEFAULT PRIVILEGES FOR ROLE core_svc IN SCHEMA core
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO etl_loader;
ALTER DEFAULT PRIVILEGES FOR ROLE core_svc IN SCHEMA core
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO etl_loader;

-- =====================================================================
-- Go — notifier (схема notify), продукт 2
-- =====================================================================
SET ROLE notify_svc;

CREATE TABLE notify.subscription (
    id               bigserial PRIMARY KEY,
    user_id          bigint      NOT NULL,                       -- sub из JWT, без FK (чужая схема)
    industry         text,
    municipality_id  int,                                        -- id из /api/dictionaries, без FK
    need             text,
    stage            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (industry IS NOT NULL OR municipality_id IS NOT NULL OR need IS NOT NULL OR stage IS NOT NULL)
);
COMMENT ON TABLE notify.subscription IS 'Go — подписки на новые инвестпроекты';

CREATE TABLE notify.notification (
    id                bigserial PRIMARY KEY,
    user_id           bigint      NOT NULL,
    subscription_id   bigint      REFERENCES notify.subscription(id) ON DELETE SET NULL,
    project_id        int         NOT NULL,                      -- id проекта из core-api, без FK
    title             text        NOT NULL,
    is_read           boolean     NOT NULL DEFAULT false,
    sent_to_telegram  boolean     NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, project_id)
);
COMMENT ON TABLE notify.notification IS 'Go — лента уведомлений';

CREATE TABLE notify.telegram_link (
    user_id      bigint PRIMARY KEY,
    link_token   text   NOT NULL UNIQUE,
    chat_id      bigint,
    linked_at    timestamptz
);
COMMENT ON TABLE notify.telegram_link IS 'Go — привязка пользователя к чату Telegram';

CREATE TABLE notify.state (
    key    text PRIMARY KEY,
    value  text NOT NULL
);
COMMENT ON TABLE notify.state IS 'Go — служебное состояние воркера (lastCheckedAt)';

RESET ROLE;

-- =====================================================================
-- C# — калькулятор сделок (схема calc), резерв
-- =====================================================================
SET ROLE calc_svc;

CREATE TABLE calc.region_coef (
    id      serial PRIMARY KEY,
    name    text    NOT NULL UNIQUE,
    coef    numeric(5, 3) NOT NULL,
    reason  text
);
CREATE TABLE calc.project_level (
    code         text PRIMARY KEY,                               -- basic | advanced | expert
    name         text NOT NULL,
    coef         numeric(5, 3) NOT NULL,
    description  text
);
CREATE TABLE calc.work_stage (
    code                text PRIMARY KEY,                        -- pir | pnr | shef
    name                text NOT NULL,
    share_of_equipment  numeric(5, 4) NOT NULL,                  -- 0.10 = 10% от стоимости оборудования
    comment             text
);
CREATE TABLE calc.component (
    id            text PRIMARY KEY,                              -- el_01, ht_02 ...
    system_group  text NOT NULL,
    name          text NOT NULL,
    unit          text NOT NULL,
    base_price    numeric(12, 2) NOT NULL,
    complexity    numeric(5, 3) NOT NULL
);
COMMENT ON TABLE calc.component IS 'C# — оборудование и базовые цены из МОД3_Таб4 (сид)';

RESET ROLE;

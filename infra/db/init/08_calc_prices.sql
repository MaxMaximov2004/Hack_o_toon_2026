-- =====================================================================
-- 08 — парсинг цен для калькулятора (кейс, слайд 3: «оценка стоимости проекта …
-- и парсингом цен на оборудование/ПО»). Парсер — в ETL (etl/etl/prices.py):
--   прайс-листы Ростелекома (PDF)  -> base_price + price_source/price_date;
--   tinko.ru (рыночный аналог той же серии модели) -> market_*.
-- Позиции МОД3 из таблицы кейса не трогаются: price_source = NULL («цена из кейса»).
-- Применить к существующей БД: psql … -f этот файл (или docker compose down -v && up).
-- =====================================================================
SET ROLE calc_svc;

ALTER TABLE calc.component
    ADD COLUMN price_source      text,                 -- 'rt.ru: прайс «Видеонаблюдение»'; NULL — цена из таблицы кейса
    ADD COLUMN price_url         text,
    ADD COLUMN price_date        date,                 -- «Тарифы действуют с …» из прайса
    ADD COLUMN price_checked_at  timestamptz,          -- когда парсер последний раз подтвердил цену
    ADD COLUMN market_price      numeric(12, 2),       -- минимальная цена аналога в магазине
    ADD COLUMN market_source     text,                 -- 'tinko.ru'
    ADD COLUMN market_note       text,                 -- 'серия HFW1230, 9 предл., медиана 3 667 ₽'
    ADD COLUMN market_url        text,
    ADD COLUMN market_checked_at timestamptz;

-- ETL обновляет цены и добавляет новые модели из прайса; удалять и менять структуру не может
GRANT USAGE ON SCHEMA calc TO etl_loader;
GRANT SELECT, INSERT, UPDATE ON calc.component TO etl_loader;

RESET ROLE;

SET ROLE etl_loader;

CREATE TABLE etl.price_run (
    id           bigserial PRIMARY KEY,
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    status       text        NOT NULL DEFAULT 'running',   -- running | ok | failed
    details      jsonb                                     -- по источникам: online/кэш, сколько цен, новые модели, ошибки
);
COMMENT ON TABLE etl.price_run IS 'Python — ETL: запуски парсинга цен калькулятора';

RESET ROLE;

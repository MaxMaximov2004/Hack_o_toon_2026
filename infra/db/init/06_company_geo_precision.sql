-- =====================================================================
-- 06 — точность координат компании. Адресов в реестре МСП нет, ETL ставит
-- компанию на реальное здание из OpenStreetMap (etl/data/buildings.csv.gz):
--   settlement   — здание в указанном населённом пункте (до ~2–4 км от центра);
--   municipality — здание где-то в районе / городском округе;
--   approx       — зданий нет, случайная точка около центра (как раньше).
-- Фронт показывает это в карточке: «позиция условная, по населённому пункту/району».
-- Применить к существующей БД: docker compose down -v && docker compose up -d --build.
-- =====================================================================
SET ROLE core_svc;

ALTER TABLE core.company ADD COLUMN geo_precision text NOT NULL DEFAULT 'approx'
    CHECK (geo_precision IN ('settlement', 'municipality', 'approx'));

RESET ROLE;

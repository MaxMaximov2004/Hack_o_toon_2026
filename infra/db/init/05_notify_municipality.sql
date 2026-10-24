-- =====================================================================
-- 05 — ПРОДУКТ 2: notifier хранит название района в уведомлении
-- (Notification.municipalityName в docs/tz/08-product2-contract.md):
-- лента показывается без запроса к core-api. Ведёт: Java #2 (техлид).
-- =====================================================================
SET ROLE notify_svc;

ALTER TABLE notify.notification ADD COLUMN municipality_name text;
COMMENT ON TABLE notify.subscription IS 'Java — notifier: подписки на новые инвестпроекты';
COMMENT ON TABLE notify.notification IS 'Java — notifier: лента уведомлений';
COMMENT ON TABLE notify.telegram_link IS 'Java — notifier: привязка пользователя к чату Telegram';
COMMENT ON TABLE notify.state IS 'Java — notifier: служебное состояние воркера (lastCheckedAt)';

RESET ROLE;

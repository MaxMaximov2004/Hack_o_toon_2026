# Примеры ответов core-api

Формы — строго по [02-java-1-core-api](../../docs/tz/02-java-1-core-api.md). На них фронт делает MSW-заглушки, export-service — `USE_STUB`.
Данные выдуманные (ИНН, названия, контакты), цифры внутри одного файла согласованы.

| Файл | Запрос |
| --- | --- |
| `dictionaries.json` | `GET /api/dictionaries` |
| `cells.json` | `GET /api/map/cells?zoom=7` — вся область, `status=active` по умолчанию (поэтому `excluded` = 0) |
| `points.json` | `GET /api/map/cells?zoom=13&status=all&minLat=47.09&maxLat=47.13&minLon=39.39&maxLon=39.45` — Азов, есть серая точка |
| `companies.json` | `GET /api/companies?sort=revenueEst,desc` — `NULLS LAST`, затем `id` |
| `company.json` | `GET /api/companies/101` |
| `stats.json` | `GET /api/municipalities/stats?industry=all` |
| `white-spots.json` | `GET /api/white-spots?industry=all&limit=10` |
| `companies-internal.json` | `GET /internal/companies?status=all` — массив полных `Company`, сортировка по `name` |

**Продукт 2** — формы по [08-product2-contract](../../docs/tz/08-product2-contract.md). Проекты и компании — из реальных
данных после ETL (лист МОД2 и реестр МСП), услуги — из `infra/db/init/04_need_offer.sql`; подписки и лента — выдуманные.

| Файл | Запрос | Сервис |
| --- | --- | --- |
| `projects.json` | `GET /api/projects?industry=manufacturing&sort=amountMln,desc&size=3` | core-api |
| `project.json` | `GET /api/projects/31` | core-api |
| `timeline.json` | `GET /api/projects/timeline?industry=manufacturing` | core-api |
| `projects-internal.json` | `GET /internal/projects?updatedSince=2026-10-24T00:00:00Z&municipalityId=53&industry=logistics` | core-api |
| `related-companies.json` | `GET /api/projects/31/related-companies` (в примере 3 компании из 20) | core-api |
| `subscriptions.json` | `GET /api/subscriptions` | notifier |
| `notifications.json` | `GET /api/notifications` | notifier |
| `telegram-link.json` | `GET /api/notifications/telegram-link` | notifier |

`dictionaries.json` — поля `stages` и `needs` заполнены для продукта 2.

Соглашения:

- Поле с неизвестным значением присутствует со значением `null`, а не пропускается (`employees`, `revenueEst`, `settlement`, `excludedAt`…).
- `revenueEst`, `revenueEstSum` — рубли, целое число. `revenueGrowthEst` — %, один знак после запятой.
- `coverage` = `clients / companies`, 4 знака; `potentialScore` — 0..100, до 2 знаков.
- `reason` — текст из SQL-функции `core.refresh_municipality_stats`, у не белых пятен — `null`.
- `kind`: `ours` — действующий клиент РТ, `others` — не клиент, `excluded` — клиент, исключённый из реестра МСП.
- Даты — `"YYYY-MM-DD"`.

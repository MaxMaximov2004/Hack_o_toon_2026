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

Соглашения:

- Поле с неизвестным значением присутствует со значением `null`, а не пропускается (`employees`, `revenueEst`, `settlement`, `excludedAt`…).
- `revenueEst`, `revenueEstSum` — рубли, целое число. `revenueGrowthEst` — %, один знак после запятой.
- `coverage` = `clients / companies`, 4 знака; `potentialScore` — 0..100, до 2 знаков.
- `reason` — текст из SQL-функции `core.refresh_municipality_stats`, у не белых пятен — `null`.
- `kind`: `ours` — действующий клиент РТ, `others` — не клиент, `excluded` — клиент, исключённый из реестра МСП.
- Даты — `"YYYY-MM-DD"`.

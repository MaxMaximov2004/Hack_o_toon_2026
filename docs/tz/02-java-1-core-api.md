# 02. Java #1 — core-api: радар

**Владелец:** Java #1. **Папка:** `core-api/`, пакеты `radar/` (продукт 1) и `invest/` (продукт 2).
Пакеты `common/` (безопасность, ошибки), `clients/` (импорт клиентов) и `locations/` (задача со *) ведёт Java #2 — см. [03](03-java-2-techlead.md).
**Порт:** 8080. **БД:** схема `core`, пользователь `core_svc`, только чтение (данные заливает ETL).
**Стек:** Java 21, Spring Boot 3, Spring Web, `NamedParameterJdbcTemplate` (или Spring Data JDBC), Jackson, springdoc-openapi.

Таблицы уже созданы в `infra/db/init/02_tables.sql`. Никакого Flyway и `ddl-auto` (`spring.flyway.enabled=false`,
`spring.jpa.hibernate.ddl-auto=none`, если JPA).

**Объём:** в `core.company` будет 759 наших клиентов + весь реестр МСП Ростовской области (десятки–сотни тысяч).
Проверено на 200 000 синтетических строк: агрегация карты по всей области — ~50 мс, выборка по окну карты — < 1 мс.
Индексы уже есть: `(municipality_id)`, `(industry)`, `(is_client, status)`, `(lat, lon)`.

## Первый час

- [ ] Скелет Spring Boot, `Dockerfile` (multi-stage: `maven:3.9-eclipse-temurin-21` → `eclipse-temurin:21-jre`), `GET /health`.
- [ ] Примеры ответов всех эндпоинтов ниже — в `contracts/examples/` (`dictionaries.json`, `companies.json`, `company.json`,
      `cells.json`, `points.json`, `stats.json`, `white-spots.json`, `companies-internal.json` — массив из 5–10 полных `Company`).
      На них фронт и C# делают заглушки.
- [ ] springdoc: `/swagger-ui` — сверка с контрактом.

## Общий фильтр — один построитель

`CompanyFilter` (record) — параметры и смысл в 00-common. Разбор и проверка:

- `client` ∈ {`all`, `ours`, `others`}, по умолчанию `all`; `status` ∈ {`active`, `excluded`, `all`}, по умолчанию `active`;
- коды отраслей и категорий — из enum; `revenueMin ≤ revenueMax`; `q` ≥ 2 символов;
- границы окна — все четыре или ни одного, `minLat < maxLat`, `minLon < maxLon`.

Ошибка → 400 `VALIDATION_ERROR` с именем поля в `details.field`.

**Один класс** `CompanyFilterSql` строит `WHERE` и параметры. Им пользуются список, карта и `/internal/companies` —
фильтр работает везде одинаково. Добавлять только заданные условия:

```sql
WHERE 1 = 1
  AND c.is_client = true                     -- client=ours
  AND c.is_client = false                    -- client=others
  AND c.status = 'active'                    -- status=active (по умолчанию) | 'excluded' | без условия при all
  AND c.industry = ANY(:industries)
  AND c.municipality_id = ANY(:municipalityIds)
  AND c.size_category = ANY(:sizes)
  AND c.revenue_est >= :revenueMin
  AND c.revenue_est <= :revenueMax
  AND c.revenue_growth_est >= :growthMin
  AND c.is_new = true
  AND c.lat BETWEEN :minLat AND :maxLat AND c.lon BETWEEN :minLon AND :maxLon
  AND (c.name ILIKE '%' || :q || '%' OR c.inn LIKE :q || '%')
```

`kind` компании для ответов: `others`, если `NOT is_client`; `excluded`, если клиент и `status = 'excluded'`; иначе `ours`.

## Эндпоинты продукта 1

Все требуют JWT (проверку делает `common/` от Java #2). Ошибки — в общем формате.

### `GET /api/dictionaries`

```json
{
  "industries": [ { "code": "agro", "name": "Сельское хозяйство" } ],
  "municipalities": [ { "id": 1, "name": "г. Ростов-на-Дону", "kind": "city", "lat": 47.2357, "lon": 39.7015 } ],
  "sizeCategories": [ { "code": "micro", "name": "Микропредприятие" }, { "code": "small", "name": "Малое" }, { "code": "medium", "name": "Среднее" } ],
  "stages": [], "needs": []
}
```

Отрасли, категории, стадии, потребности — enum в Java с русскими названиями (коды из 00-common не менять).
Районы — `SELECT id, name, kind, lat, lon FROM municipality ORDER BY kind DESC, name`. Кэш в памяти.

### `GET /api/map/cells` — карта «как выбор ПВЗ»

Параметры: `CompanyFilter` + `zoom` (целое 3–18, обязателен). Без границ окна — вся область.

**Логика:**

1. `total = SELECT count(*) FROM company c <WHERE>`.
2. Если `total ≤ 1500` → **точки**:
   ```sql
   SELECT c.id, round(c.lat::numeric, 5) lat, round(c.lon::numeric, 5) lon,
          CASE WHEN NOT c.is_client THEN 'others' WHEN c.status = 'excluded' THEN 'excluded' ELSE 'ours' END kind
   FROM company c <WHERE>
   ```
   Ответ `{ "mode": "points", "total": 312, "points": [ { "id": 101, "lat": 47.11, "lon": 39.42, "kind": "ours" } ] }`.
3. Иначе → **кластеры по сетке**. Размер ячейки ≈ 60 пикселей экрана на этом зуме:
   ```
   cellDeg = 84 / 2^zoom        # zoom 7 → 0.656°, zoom 10 → 0.082°, zoom 12 → 0.0205°
   ```
   ```sql
   SELECT round(avg(c.lat)::numeric, 4) lat, round(avg(c.lon)::numeric, 4) lon,
          count(*) total,
          count(*) FILTER (WHERE c.is_client AND c.status = 'active')   ours,
          count(*) FILTER (WHERE NOT c.is_client)                       others,
          count(*) FILTER (WHERE c.is_client AND c.status = 'excluded') excluded
   FROM company c <WHERE>
   GROUP BY floor(c.lat / :cellDeg), floor(c.lon / :cellDeg)
   ```
   Центр кластера — среднее координат его компаний (а не центр ячейки): кружки встают туда, где бизнес, а не сеткой.
   Ответ `{ "mode": "cells", "cellDeg": 0.656, "total": 182344, "cells": [ { "lat", "lon", "total", "ours", "others", "excluded" } ] }`.

### `GET /api/companies`

Параметры: `CompanyFilter` + `page` (0), `size` (50, ≤ 200), `sort` (`revenueEst,desc`). Ответ — страница `CompanyShort`:

```json
{
  "items": [ {
    "id": 101, "inn": "0265052371", "name": "ООО \"ВЭЛНЕФТЕМОНТАЖ\"",
    "industry": "manufacturing", "industryName": "Производство",
    "okvedCode": "33.12", "okvedName": "Ремонт машин и оборудования",
    "municipalityId": 1, "municipalityName": "г. Ростов-на-Дону", "settlement": null,
    "lat": 47.2313, "lon": 39.7233,
    "sizeCategory": "micro", "employees": 3,
    "revenueEst": 18500000, "revenueGrowthEst": 12.5, "revenueSource": "model", "isEstimated": true,
    "isClient": true, "status": "active", "kind": "ours", "excludedAt": null,
    "isNew": false, "registeredAt": "2022-07-10"
  } ],
  "page": 0, "size": 50, "total": 182344
}
```

**Логика:** фильтр → `count(*)` + `SELECT ... JOIN municipality m ... ORDER BY ... LIMIT :size OFFSET :page*:size`.
Сортировка — только из белого списка через `switch` (`name`, `revenueEst` → `revenue_est`, `revenueGrowthEst`,
`employees`, `registeredAt`), всегда `NULLS LAST`, вторым ключом `id` (стабильная пагинация). Строку из запроса в SQL не подставлять.

### `GET /api/companies/{id}`

`Company` = `CompanyShort` + `ogrn`, `subjectType` (`ip` | `legal`), `phone`, `email`, `website`, `hasLicenses`,
`isInnovative`, `isSocial`. Нет → 404.

### `GET /api/municipalities/stats?industry=all`

```json
[ {
  "municipalityId": 7, "name": "Аксайский р-н", "kind": "district", "lat": 47.27, "lon": 39.87,
  "industry": "all", "companies": 8100, "clients": 41, "excludedClients": 3, "coverage": 0.0051,
  "newShare": 0.17, "revenueEstSum": 64000000000, "potentialScore": 74.0, "isWhiteSpot": false, "reason": null
} ]
```

`SELECT ... FROM municipality_stats s JOIN municipality m ON m.id = s.municipality_id WHERE s.industry = :industry`;
`coverage = clients / companies`. Цифры считает ETL (и пересчитывает импорт клиентов) — **формулы в Java не дублировать**.

### `GET /api/white-spots?industry=all&limit=10`

```json
[ { "municipalityId": 23, "name": "Сальский р-н", "lat": 46.47, "lon": 41.54,
    "potentialScore": 81.0, "companies": 5400, "clients": 0,
    "reason": "5 400 действующих компаний, 22% новых, ни одного клиента РТ" } ]
```

`... WHERE s.industry = :industry AND s.is_white_spot ORDER BY s.potential_score DESC LIMIT :limit` (1–50).

### `GET /internal/companies` — для export-service

`CompanyFilter` без пагинации, ответ — JSON-массив полных `Company`, сортировка `name`. Защита — `X-Internal-Token`.

- Сначала `count(*)`; больше `limit` (параметр, по умолчанию и максимум 100 000) → 413 `TOO_LARGE` с `details.total`.
- Отдавать **потоком**: `StreamingResponseBody` + Jackson `JsonGenerator`, строки читать `JdbcTemplate.query(..., RowCallbackHandler)`
  с `fetchSize = 1000` (в транзакции, иначе драйвер Postgres загрузит всё в память). Список целиком в памяти не собирать.

## Логика вне эндпоинтов

- `GET /health` → 200 `{"status":"ok"}`, если `SELECT 1` прошёл; иначе 503.
- HikariCP `initializationFailTimeout=-1`, `connectionTimeout=2000` — сервис стартует, даже если Postgres ещё поднимается.
- Лог — одна строка на запрос: метод, путь, статус, время. Медленнее 500 мс — `WARN` с параметрами фильтра.

## Тесты (минимум)

- [ ] Testcontainers Postgres + `infra/db/init/*.sql` + свои строки: `client=ours/others/all`, `status=excluded`, окно карты,
      переход `cells` → `points` при малом `total`, невалидная сортировка → 400.

## Продукт 2 (после зелёной сборки)

`GET /api/projects` (`ProjectFilter`: `stage`, `industry`, `need`, `municipalityId`, `yearFrom`, `yearTo`, `isKey`, `amountMin`, `q`),
`GET /api/projects/{id}`, `GET /api/projects/timeline` (на каждый проект события `start` и `launch`, группировка по году),
`GET /internal/projects?updatedSince=` для notifier и export-service.

## Готово, когда

Все эндпоинты продукта 1 отвечают на реальных данных после `docker compose up -d --build`; карта на всей области —
быстрее 300 мс; формы совпадают с `contracts/examples/`; фронт работает с выключенным MSW; тесты зелёные.

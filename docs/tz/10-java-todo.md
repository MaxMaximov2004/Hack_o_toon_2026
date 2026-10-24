# 10. Java — вся Java-часть: что сделать

**Кому:** Java #1 — теперь **вся Java**: `core-api/` целиком (включая пакеты техлида) и `notifier/`.
Техлид переключился на Python для продукта 2. **Порядок важен:** пункт 1 блокирует фронт и уведомления.
Контракт продукта 2 — [08-product2-contract.md](08-product2-contract.md), примеры ответов — `contracts/examples/`.

## Что уже есть в коде (не делать заново)

| Где | Что | Кто писал |
| --- | --- | --- |
| `core-api/.../radar/*` | продукт 1: справочники, карта, компании, статистика, белые пятна, `/internal/companies` | ты |
| `core-api/.../common/exception` | единый формат ошибок `GlobalExceptionHandler`; `ValidationException(field, msg)`, `NotFoundException`, `TooLargeException`; шаблоны — `common/util/LogPatterns` | техлид |
| `core-api/.../common/security` | JWT по JWKS (`iss=radar-auth`, `amr` содержит `otp`, роли из `roles` → `ROLE_*`), `X-Internal-Token` для `/internal/**`, 401/403/502 в формате контракта | техлид |
| `core-api/.../related` | `GET /api/projects/{id}/related-companies` — **готов**, не делать | техлид |
| `CompanyRepository.findWhere(...)` | публичный метод для `related` (те же колонки и маппинг, что у списка) | техлид |
| `notifier/` | сервис продукта 2 на Java: подписки, лента, воркер, Telegram; устроен как core-api (тот же `common/`) | техлид |

**Правила, которые уже действуют:**

- Любой `/internal/**` в core-api сам требует `X-Internal-Token` — в контроллере ничего не нужно. `/api/**` требует JWT.
  Роль — `.requestMatchers(...).hasRole("ADMIN")` в `common/security/SecurityConfig`.
- Тесты бизнес-логики — от `DbWebTest` (фильтры безопасности там выключены); доступ проверяет
  `common/security/SecurityTest`. Форма ответа — `ContractShape.assertMatches("<пример>.json", json)`.
- Перед пушем: `.\mvnw.cmd test` (минимум `compile`) и `git pull --rebase`. Один раз `main` уже не собирался из-за
  битого импорта — это ловится за 20 секунд.

## 1. Продукт 2 в core-api — СРОЧНО

Пакет на твой выбор (например, `ru.rt.radar.invest`), формы — строго по [08](08-product2-contract.md) и примерам.

| Эндпоинт | Пример | Заметки |
| --- | --- | --- |
| `GET /api/dictionaries` — заполнить `stages`, `needs` | `dictionaries.json` | коды и названия — в 08 |
| `GET /api/projects?<ProjectFilter>&page&size&sort` | `projects.json` | `ProjectFilter` — по образцу `CompanyFilter` (свой парсер + SQL); сортировки в 08 |
| `GET /api/projects/{id}` | `project.json` | нет — 404 |
| `GET /api/projects/timeline?<ProjectFilter>` | `timeline.json` | события `start` / `launch`, группировка по году, `total` = число проектов |
| `GET /internal/projects?updatedSince=&<ProjectFilter>` | `projects-internal.json` | массив полных `Project`, `updated_at > updatedSince`, сортировка `updatedAt, id`; **его ждёт notifier** |

- `lat` / `lon` проекта — центр муниципалитета из `municipality`.
- `recommendedOffers` — из `core.need_offer` (заполнен `infra/db/init/04_need_offer.sql`) в порядке `needs`:
  `[{ need, needName, offers[] }]`.
- `stageName`, `industryName`, `needName` — из тех же справочников, что `/api/dictionaries`.
- Данные: 63 проекта в `core.invest_project` (грузит ETL). Python доразмечает отрасли и потребности — **коды не меняются**.

**Сквозная проверка уведомлений** (после `/internal/projects`):

```bash
docker compose --profile product2 up -d --build
# подписка (через Swagger notifier или curl с JWT): POST /api/subscriptions {"industry":"logistics"}
docker compose exec etl python -m etl demo-project        # логистический проект с updated_at = now()
docker compose exec etl python -c "import urllib.request as u; print(u.urlopen(u.Request('http://notifier:8083/internal/notifier/check', method='POST', headers={'X-Internal-Token':'internal_dev_token'})).read())"
# GET /api/notifications — появилось уведомление
```

Пока `/internal/projects` нет, ручная проверка notifier честно отвечает 502 «core-api не ответил на /internal/projects: 404».

## 2. notifier — теперь твой

Уже сделан и покрыт тестами (`notifier/src/test`, 13 тестов на Testcontainers). Твоя задача — сквозная проверка из
пункта 1, когда появится `/internal/projects`, и правки, если контракт уточнится.

- `subscription/` — подписки (`GET/POST/DELETE /api/subscriptions`), коды проверяются по `Codes`.
- `notification/` — лента (`GET /api/notifications`, `read`, `read-all`, `telegram-link`).
- `worker/` — проверка проектов раз в `CHECK_INTERVAL` + ручной `POST /internal/notifier/check`.
- `telegram/` — бот через long polling; без `TELEGRAM_BOT_TOKEN` выключен, остальное работает.
- Правило: в ленту попадают только проекты, изменённые **после** создания подписки.
- Тесты запускать так же, как в core-api: `cd notifier; .\mvnw.cmd test` (нужен Docker для Testcontainers).

## 3. `POST /api/clients/import` (роль admin) — после пункта 1

ТЗ — [03-java-2-techlead.md](03-java-2-techlead.md), раздел «`clients/`», пакет `clients/`.
Коротко: CSV до 10 МБ (`file`), `mode=append|replace`; ИНН из колонки `inn`/`ИНН` или первой; 9/11 цифр → ведущий ноль;
одна транзакция; пересчёт **той же SQL-функцией** `SELECT refresh_municipality_stats()` → `whiteSpots` в ответе
`{ rows, matched, notFound[], mode, whiteSpots }`. Пустой файл / ни одного валидного ИНН → 400. Файл больше 10 МБ —
413 уже отдаёт `GlobalExceptionHandler`.

- Роль `admin` для `POST /api/clients/import` уже настроена в `SecurityConfig`.
- **Удалить заглушку** `@PostMapping("/api/clients/import")` из теста `common/security/SecurityProbeController`
  (помечена `TEMP`) — иначе два маппинга одного пути. `SecurityTest.importNeedsAdmin` после этого проверяет настоящий
  эндпоинт: manager → 403, admin → не 403.
- Фронт: диалог «Обновить список клиентов» для админа (сделает фронт в конце).

## 4. Задача со звёздочкой `locations/` — если останется время

ТЗ — [07-star-actual-location.md](07-star-actual-location.md): `GET/POST/DELETE /api/companies/{id}/locations`,
`POST /api/locations/import` (admin), фильтр `relocated=true` в `CompanyFilterSql`, поле `relocated` в `CompanyShort`
(тогда обновить `companies.json` и тесты формы). Таблица `core.company_location` уже есть и переживает перезагрузку ETL.
По жюри — доп. баллы за бизнес-инсайт.

## Готово, когда

`docker compose --profile product2 up -d --build` → «Навигатор» получает проекты, таймлайн и карточку с услугами РТ;
подписка + `demo-project` + проверка → уведомление в ленте (и в Telegram, если бот настроен); импорт клиентов меняет
белые пятна; `.\mvnw.cmd test` зелёный в `core-api` и `notifier`.

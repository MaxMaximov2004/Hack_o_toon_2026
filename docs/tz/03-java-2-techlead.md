# 03. Java #2 — техлид: сборка, БД, безопасность core-api, импорт клиентов

**Владелец:** Java #2. **Зона:** корень репозитория (`docker-compose.yml`, `README.md`, `.env.example`), `infra/`
(init БД, nginx, смоук), `contracts/`, `tools/`, в `core-api/` — пакеты `common/`, `clients/`, `locations/` (задача со *).
Принимает все PR, держит контракт, собирает систему одной командой.

Уже готово в репозитории: `docker-compose.yml`, `infra/db/init/01–03` (роли с комментариями, схемы, все таблицы, функция
расчёта белых пятен, сид клиентов), `infra/nginx/`, `infra/smoke.sh`, `tools/rmsp/prepare_rmsp.py`, `.env.example`, README,
инструкция по реестру. Задача — довести до зелёной сборки и поддерживать.

## Первый час

- [ ] Репозиторий из каркаса, защитить `main` (только PR), раздать доступы.
- [ ] `docker compose up -d postgres` → `docker compose exec postgres psql -U postgres -d radar -c "select count(*) from etl.raw_clients"` → 759.
- [ ] Тестовая пара RSA и `jwks.json` в `contracts/dev-keys/` — чтобы core-api и C# проверяли JWT, пока Go не готов.
- [ ] Каждому — ссылка на его ТЗ и `00-common.md`. Python — дополнительно `docs/data/rmsp-instruction.md` (выгрузка реестра — первая задача, от её объёма зависит карта).
- [ ] Когда Python пришлёт цифры отчёта по реестру — проверить размер `etl/data/rmsp_61.csv.gz`. Больше 50 МБ → Git LFS
      или хранить вне git и скачивать в `etl/Dockerfile`.

## `common/` в core-api — безопасность и ошибки

### Проверка JWT

- Spring Security OAuth2 Resource Server, `jwk-set-uri = ${AUTH_JWKS_URL}`. JWKS — лениво при первом запросе (не при старте:
  иначе core-api падает, если auth-service ещё поднимается).
- Доп. `OAuth2TokenValidator<Jwt>`: `iss == "radar-auth"` и `amr` содержит `"otp"`, иначе 401.
- Публичные пути: `/health`, `/swagger-ui/**`, `/v3/api-docs/**`. `/internal/**` — без JWT, но с фильтром ниже. Остальное — `authenticated()`.
- Роль `admin` (claim `roles`) — для `POST /api/clients/import`. CORS не нужен (один домен через nginx), CSRF выключить.

### Фильтр `/internal/**`

`OncePerRequestFilter`: `X-Internal-Token` сравнить с `${INTERNAL_TOKEN}` через `MessageDigest.isEqual`. Не совпал → 401.

### Ошибки

`@RestControllerAdvice` → общий формат `{ "error": { code, message, details } }`: ошибки параметров → 400 `VALIDATION_ERROR`;
`NotFoundException` → 404; `TooLargeException` → 413 `TOO_LARGE`; `AuthenticationEntryPoint` тоже отдаёт этот JSON (401);
остальное → 500 `INTERNAL_ERROR`, стектрейс — только в лог.

## `clients/` — `POST /api/clients/import` (роль `admin`)

Обновление списка клиентов Ростелекома без пересборки — например, свежей выгрузкой из CRM. `multipart/form-data`:
`file` (CSV до 10 МБ), `mode` = `append` (по умолчанию) или `replace`. Ответ:

```json
{ "rows": 120, "matched": 112, "notFound": ["6161000000"], "mode": "append", "whiteSpots": 5 }
```

**Логика:**

1. CSV: UTF-8 (с BOM или без), разделитель `;` или `,` (по первой строке). ИНН — колонка `inn`/`ИНН` (без регистра), иначе первая.
2. ИНН: только цифры, длина 10 или 12 (9/11 — дописать ведущий ноль), иначе в `notFound`. Дубли убрать.
3. Одна транзакция:
   - `replace`: `UPDATE company SET is_client = false WHERE is_client`, затем шаг `append`;
   - `append`: `UPDATE company SET is_client = true, updated_at = now() WHERE inn = ANY(:inns)`;
   - `matched` — число обновлённых строк; `notFound` — ИНН, которых нет в `company` (до 100 в ответе).
   - Статус (`active`/`excluded`) не трогаем — его определяет реестр.
4. **Пересчитать районы той же функцией, что и ETL:** `SELECT refresh_municipality_stats()` → `whiteSpots` в ответе.
   Формулы в Java не писать. Пересчёт ~0,2 с на 200 000 компаний.
5. Пустой файл или ни одного валидного ИНН → 400.

**Важно:** ETL при перезапуске пересобирает `company` из кейса и реестра, и импорт пропадёт. Для хакатона это нормально
(импорт — демонстрация «обновили список из CRM»). Если нужно, чтобы импорт переживал перезагрузку, — отдельная таблица
`core.client_override` (PR в `02_tables.sql`), которую ETL применяет последним шагом.

## Инфраструктура — поддерживать

- [ ] `docker-compose.yml`: один блок на сервис; переменные окружения — контракт с участниками.
- [ ] `infra/db/init`: структура только здесь. Новая таблица/колонка → новый файл `04_<что>.sql` (с `SET ROLE <владелец>` и
      комментарием, чей сервис) → в чат «всем `down -v && up -d`». До первой общей сборки можно править `02_tables.sql`.
- [ ] Калибровку белых пятен от Python (порог, минимум компаний) — внести как значения по умолчанию в
      `core.refresh_municipality_stats` (02_tables.sql), чтобы ETL и импорт считали одинаково.
- [ ] Сид клиентов пересобирать только генератором: `python3 infra/db/tools/gen_seed.py infra/db/tools/case.xlsx infra/db/init/03_seed.sql`.
- [ ] `infra/nginx/nginx.conf`: маршруты из 00-common; `/internal/` → 404.
- [ ] `infra/smoke.sh` — дополнять (логин демо-пользователя, экспорт).

## Сборка — процедура

```bash
git pull
docker compose down -v
docker compose up -d --build
docker compose ps            # все running, etl — exited (0)
bash infra/smoke.sh          # «ВСЁ ЗЕЛЁНОЕ»
```

Затем — демо-сценарий руками в браузере и на телефоне. Красное → `docker compose logs <сервис>` → владельцу в чат; `main`
не трогаем до починки. Зелёное → `git tag p1-build-N && git push --tags`. Нет чьей-то папки — промежуточная сборка
перечислением готовых сервисов (README), тег — только на полную сборку одной командой.

**Ревью PR — чек-лист:** только своя папка; `Dockerfile` и `/health`; конфиг из env с именами как в compose; нет `localhost`
в коде; нет создания таблиц из кода; поднимается `docker compose up -d --build postgres <сервис>`.

## Демо-стенд

- [ ] Машина для защиты: `git clone`, `docker compose up -d --build` за 3 часа до сдачи.
- [ ] Видео полного демо-прохода — запасной вариант на случай сети.

## Продукт 2 (после зелёной сборки продукта 1)

- `GET /api/projects/{id}/related-companies`: инициатор найден в `company` (нормализованное название без ОПФ, кавычек, регистра)
  → `relation: "initiator"`; плюс до 20 компаний той же отрасли в том же районе → `"same_area_industry"`.
- `core.need_offer` (наполнить в `04_need_offer.sql`), поле `recommendedOffers` в проекте; формулировки услуг — с куратором.
- `PRODUCT2=1 bash infra/smoke.sh`.

## Задача со звёздочкой — `locations/`

Эндпоинты и логика — в [07](07-star-actual-location.md): чтение и ввод фактических адресов, импорт из CSV, фильтр
«работает не там, где зарегистрирован». Таблица `core.company_location` уже создана (по ИНН, переживает перезагрузку ETL).

## Готово, когда

`docker compose down -v && docker compose up -d --build` на чистой машине поднимает всё одной командой, `bash infra/smoke.sh`
зелёный, импорт клиентов меняет белые пятна на карте.

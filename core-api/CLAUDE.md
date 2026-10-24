# CLAUDE.md — core-api («Радар присутствия»), часть Java #1

Этот файл — контекст для Claude Code. Положить в `core-api/CLAUDE.md` (или в корень репозитория).
Источник истины — ТЗ в `docs/tz/`. Если этот файл и ТЗ расходятся, прав ТЗ; скажи мне о расхождении.

## 0. Прочитай перед началом (по порядку)

1. `README.md` — правила БД, требования к сервисам, процесс сборки.
2. `docs/tz/00-common.md` — контракт: статусы, справочники отраслей, `CompanyFilter`, формат ошибок, пагинация, JWT.
3. `docs/tz/02-java-1-core-api.md` — **моё ТЗ** (эндпоинты, SQL, логика карты).
4. `docs/tz/03-java-2-techlead.md` — разделы про `common/` и `clients/` (их делает другой человек, но я от них завишу).
5. `infra/db/init/02_tables.sql` — реальная структура таблиц `core.*` и функция `core.refresh_municipality_stats`.
6. `docker-compose.yml` (блок `core-api`) и `infra/nginx/nginx.conf`.
7. Для понимания потребителей: `docs/tz/01-frontend.md` (кто вызывает мои эндпоинты) и `docs/tz/06-csharp-export.md` (кто вызывает `/internal/companies`).

## 1. Что такое проект

Хакатон Ростелекома, кейс «Экосистема коммерческого блока». Продукт 1 — «Радар присутствия»: карта Ростовской области
«как выбор ПВЗ». Наши клиенты и потенциальные клиенты показаны двумя цветами, есть фильтры, белые пятна (районы с высоким
потенциалом и низким охватом), список, синхронный с картой, карточка компании, экспорт, вход с 2FA.
Продукт 2 («Инвестиционный навигатор») — только после зелёной сборки продукта 1.

Микросервисы: frontend (React), core-api (Java, мой), auth-service (Go), export-service (C#), etl (Python, разовый), nginx.

## 2. Моя зона ответственности

С `docs/tz/10-java-todo.md` вся Java — моя: `core-api/` целиком (включая пакеты техлида) и `notifier/`.
Но правки в `common/` и в `notifier/` — только по прямому разрешению в этой сессии (там чужие договорённости).

| Пакет `ru.rt.radar.…` | Что | Автор |
|---|---|---|
| `radar/` (`filter`, `company`, `dictionary`, `map`, `stats`, `web`) | продукт 1 | я |
| `invest/` | продукт 2: проекты, таймлайн, `/internal/projects` | я |
| `clients/` | `POST /api/clients/import` | я |
| `locations/` | задача со *: фактические места, `relocated` | я |
| `related/` | `GET /api/projects/{id}/related-companies` | техлид |
| `common/` | ошибки (`GlobalExceptionHandler`, `ValidationException`, `NotFoundException`, `TooLargeException`, `LogPatterns`), безопасность (`SecurityConfig`: JWT по JWKS, `X-Internal-Token`, роли) | техлид |
| `config/` | лог запросов, резолверы фильтров, Swagger | я |

**Ошибки — только через `common/exception`** (временных заглушек больше нет). Классов для 403 и 409 там нет: 403 для
удаления чужого места отдаёт локальный `@ExceptionHandler` в `LocationController` (`AccessDeniedException` из контроллера
глобальный обработчик превратил бы в 500).
**Роли** — `.requestMatchers(...).hasRole("ADMIN")` в `common/security/SecurityConfig` (сейчас: оба импорта).
Не моё: `docker-compose.yml`, `infra/`, `README.md`, `.env.example`, остальные сервисы. Нужна правка — написать текстом.

## 3. Жёсткие правила (нарушение = PR не примут)

- **Никакого DDL из кода:** никаких Flyway, `ddl-auto=update`, `schema.sql`, `Migrate()`. Структура — только `infra/db/init`. Нужна колонка или индекс —
  написать мне текстом, я передам техлиду (PR с `04_*.sql`).
- **Только схема `core`:** чужие схемы (`auth`, `etl`, `calc`, `notify`) не читать — будет `permission denied`. Чужие данные — только по HTTP.
- **Конфиг только из переменных окружения** с именами из `docker-compose.yml`: `SERVER_PORT`, `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`,
  `SPRING_DATASOURCE_PASSWORD`, `AUTH_JWKS_URL`, `INTERNAL_TOKEN`. Никакого `localhost` и секретов в коде.
- **`Dockerfile` в `core-api/`**, multi-stage: `maven:3.9-eclipse-temurin-21` → `eclipse-temurin:21-jre`. Порт 8080.
- **`GET /health`** без авторизации → `200 {"status":"ok"}` если `SELECT 1` прошёл, иначе 503.
- **Старт без соседей:** HikariCP `initializationFailTimeout=-1`, `connectionTimeout=2000`; JWKS — лениво, не при старте.
- **Логи в stdout**, одна строка на запрос (метод, путь, статус, время); медленнее 500 мс — `WARN` с параметрами фильтра.
- Работать в ветке `feat/core-api-<что>`, в PR — только `core-api/` и `contracts/examples/`. Изменения в compose, infra, контракте — через техлида.

## 4. Стек

Java 21, Spring Boot 3, Spring Web, `NamedParameterJdbcTemplate` (без JPA), Jackson, springdoc-openapi (`/swagger-ui`), Maven.
Тесты — JUnit 5 + Testcontainers (Postgres 16).

## 5. База данных: что нужно знать

- Подключение: `jdbc:postgresql://postgres:5432/radar?currentSchema=core`, пользователь `core_svc` (владелец схемы `core`). Таблицы в SQL — без префикса схемы.
- Таблицы (структура в `02_tables.sql`): `municipality`, `company`, `municipality_stats`, `invest_project`, `company_location`, `need_offer`.
- Данные в `core.*` заливает ETL (Python). **Сервис читает**, кроме двух исключений (DDL нет нигде):
  `clients/` меняет только `company.is_client` и вызывает `refresh_municipality_stats()` в одной транзакции;
  `locations/` пишет в `company_location` (по ИНН, без FK — переживает перезагрузку ETL).
  Для локальной отладки — SQL-скрипты вне `infra/` (не коммитить).
- Ожидаемый объём: 759 наших клиентов + десятки–сотни тысяч компаний реестра. Индексы уже есть: `(municipality_id)`, `(industry)`, `(is_client, status)`, `(lat, lon)`.
- `municipality_stats` и белые пятна считает **SQL-функция** `core.refresh_municipality_stats()`. **Формулы в Java не дублировать.** Я только читаю таблицу.
- ID компаний (`serial`) меняются при каждой перезагрузке ETL — не хранить и не кэшировать их надолго.

### Статусы компаний (из `00-common`)

| | `is_client` | `status` | `kind` в ответах | Цвет |
|---|---|---|---|---|
| Действующий клиент РТ | true | active | `ours` | фиолетовый |
| Потенциальный клиент | false | active | `others` | оранжевый |
| Клиент, исключённый из реестра | true | excluded | `excluded` | серый, скрыт по умолчанию |

`kind`: `others`, если `NOT is_client`; `excluded`, если клиент и `status='excluded'`; иначе `ours`.
«Исключён из реестра» ≠ «закрылся» — так и формулировать в текстах.

## 6. Что нужно реализовать (продукт 1)

Подробности, SQL и JSON-примеры — в `docs/tz/02-java-1-core-api.md`. Здесь — чек-лист и подводные камни.

### 6.1 `CompanyFilter` + `CompanyFilterSql` (сначала это — на нём стоит всё остальное)

- Record `CompanyFilter`, параметры из `00-common`: `client`, `status`, `industry[]`, `revenueMin/Max`, `minLat/maxLat/minLon/maxLon`,
  `municipalityId[]`, `sizeCategory[]`, `growthMin`, `isNew`, `q`.
- Значения по умолчанию: `client=all`, `status=active`.
- Множественные значения — повтором параметра (`?industry=trade&industry=logistics`).
- Валидация → 400 `VALIDATION_ERROR` с `details.field`: неизвестный код enum, `revenueMin > revenueMax`, `q` короче 2 символов,
  границы окна — все четыре или ни одной, `minLat < maxLat`, `minLon < maxLon`.
- **Один класс `CompanyFilterSql`** строит `WHERE` и параметры. Используется в `/api/companies`, `/api/map/cells`, `/internal/companies`.
  Добавлять только заданные условия. Все параметры — именованные, без конкатенации значений в SQL.
- `q`: `name ILIKE '%'||:q||'%' OR inn LIKE :q||'%'`; спецсимволы `%`/`_` в `q` экранировать.
- При заданной границе выручки компании с `revenue_est IS NULL` отсекаются (поведение `>=`/`<=` это даёт само).

### 6.2 Эндпоинты

| Эндпоинт | Суть | Подводные камни |
|---|---|---|
| `GET /api/dictionaries` | отрасли, категории, стадии, потребности (enum с русскими названиями), районы из БД | районы — кэш 60 с, пустой результат не кэшируется (ETL пересоздаёт районы с новыми id и может стартовать позже core-api); коды не менять |
| `GET /api/map/cells` | `CompanyFilter` + `zoom` (3–18, обязателен); `total ≤ 1500` → `mode=points`, иначе `mode=cells` | `cellDeg = 84 / 2^zoom`; центр кластера = `avg(lat), avg(lon)`; `zoom` вне 3–18 → 400; без границ окна — вся область |
| `GET /api/companies` | страница `CompanyShort` (с полем `relocated`) | сортировка **только из белого списка через `switch`** (`name`, `revenueEst`, `revenueGrowthEst`, `employees`, `registeredAt`), `NULLS LAST`, вторым ключом `id`; `size ≤ 200`; невалидная сортировка → 400 |
| `GET /api/companies/{id}` | полный `Company` | нет → 404 |
| `GET /api/municipalities/stats?industry=all` | из `municipality_stats` JOIN `municipality` | `coverage = clients / companies` считать в Java с защитой от деления на 0; формулы потенциала не дублировать |
| `GET /api/white-spots?industry=all&limit=10` | `WHERE is_white_spot ORDER BY potential_score DESC` | `limit` 1–50 |
| `GET /internal/companies` | `CompanyFilter` без пагинации, массив полных `Company`, сортировка по `name` | см. 6.3 |

### 6.3 `/internal/companies` — потоковая выдача

- Сначала `count(*)`; если больше `limit` (параметр, по умолчанию и максимум 100 000) → 413 `TOO_LARGE` с `details.total`.
- Отдавать потоком: `StreamingResponseBody` + Jackson `JsonGenerator`; строки читать через `JdbcTemplate.query(..., RowCallbackHandler)` с `fetchSize=1000`.
- **Важно:** PostgreSQL-драйвер игнорирует `fetchSize` и грузит всё в память, если соединение в автокоммите. Нужна транзакция
  (`TransactionTemplate` / `@Transactional(readOnly = true)`) на время всего стриминга. Проверить это на 100 000 строк по памяти.
- Список целиком в памяти не собирать (проверено: `-Xmx64m`, 100 000 строк). `X-Internal-Token` проверяет `common/security/InternalTokenFilter`.
- `spring.mvc.async.request-timeout: 5m`. Ошибка посреди потока — «]» не пишется, клиент получает заведомо битый JSON.

### 6.4 Формат ответов

- JSON в camelCase, UTF-8. Даты `"2022-07-10"`, моменты — ISO-8601 UTC.
- **`null` для неизвестного, поле не пропускать** (на Jackson: `JsonInclude.ALWAYS`).
- Деньги — рубли, числом (не строкой); `numeric` из БД → `BigDecimal` или `double` — главное, чтобы формат совпадал с `contracts/examples`.
- Ошибки — общий формат `{ "error": { "code", "message", "details" } }` (коды в `00-common`).

### 6.5 `contracts/examples/`

Формы всех ответов — там; тесты сверяют их через `ContractShape` (ключи, порядок, JSON-типы, целое/дробное).
**`ContractShape` не ловит пустой массив** — статические справочники сравнивать значениями (`DictionaryApiTest`).
Меняешь форму ответа — обновляй пример в том же PR и предупреждай фронт и C#.

### 6.6 Продукт 2 — `invest/` (контракт — `docs/tz/08-product2-contract.md`)

- `ProjectFilter` + `ProjectFilterParser` + `ProjectFilterSql` — по образцу компаний, общие правила разбора — `radar/filter/QueryParams`.
  `need` → `needs && CAST(:needs AS text[])`; период — `start_year <= yearTo AND launch_year >= yearFrom`, неизвестный год не отсекает.
- `GET /api/projects` (сортировка — белый список `ProjectSort`), `/api/projects/{id}`, `/api/projects/timeline`
  (при `yearFrom/yearTo` — только события внутри периода, `total` — по проектам), `GET /internal/projects?updatedSince=`
  (строго больше, сортировка `updatedAt, id`; его вызывает notifier).
- `updatedAt` — **с микросекундами**: notifier шлёт его обратно в `updatedSince`, иначе проект приходил бы повторно.
- `lat/lon` проекта — центр муниципалитета; `recommendedOffers` — из `need_offer` (кэш 60 с) в порядке `needs`.

### 6.7 Импорты (роль admin) и задача со *

- `POST /api/clients/import` — CSV до 10 МБ (`spring.servlet.multipart`), `append|replace`, ответ `{rows, matched, notFound, mode, whiteSpots}`.
- `locations/`: `GET/POST/DELETE /api/companies/{id}/locations`, `POST /api/locations/import` (ответ + `invalid`).
  Менеджер удаляет только `source=manager`, admin — любые (колонки автора в таблице нет).
- `relocated` — **одно выражение** `CompanyFilterSql.RELOCATED` для фильтра и поля. Таблицы в `EXISTS` — через запятую:
  с `JOIN … ON c.municipality_id` Postgres выполняет подзапрос на каждую компанию (~350 мс против ~60 мс).
- Разбор CSV — общий `radar/web/Csv` (BOM, `;`/`,`, кавычки).

### 6.8 Производительность (замерено на 188–200 тыс. строк)

- `connection-init-sql: SET plan_cache_mode = force_custom_plan` — без него с 5-го вызова JDBC окна карты идут общим
  планом по индексу и работают в 2–3 раза медленнее (проверяет `DataSourceSettingsTest`).
- Карта в режиме cells: `total` = сумма по ячейкам, без отдельного `count`.
- Поиск `q` — полный проход (200–260 мс); индексы `pg_trgm` / `text_pattern_ops` предложены техлиду, в `infra` их нет.

### 6.9 Swagger

`/swagger-ui` (через nginx тоже). Кнопка **Authorize**: `bearerAuth` для `/api/**`, `internalToken` для `/internal/**`
(снаружи `/internal/` закрыт nginx — Try it out только на `core-api:8080`). `persist-authorization: true`.
Схемы раздаёт `config/OpenApiConfig` по префиксу пути.

## 7. Тесты (минимум)

Testcontainers Postgres + `infra/db/init/*` + свои строки. Что проверить: `client=ours/others/all`, `status=excluded`, окно карты,
переход `cells` → `points` при малом `total`, невалидная сортировка → 400, `/internal/companies` отдаёт 413 при превышении `limit`.

**Подвох:** `01_roles_and_schemas.sh` — это bash-скрипт, он читает пароли из окружения и создаёт роли; `02_tables.sql` делает `SET ROLE core_svc`,
поэтому роли должны существовать. Самый простой путь — смонтировать папку `infra/db/init` в `/docker-entrypoint-initdb.d` контейнера Postgres
(через `withCopyFileToContainer` / bind mount), а не использовать `withInitScript` (он принимает один SQL-файл). `03_seed.sql` кладёт только сырые данные
в `etl.*` и `calc.*`, `core.company` он НЕ заполняет — тестовые компании вставлять самому.

## 8. Порядок работы

Продукт 1 (шаги 1–9 исходного плана) и пункты 1–4 из `docs/tz/10-java-todo.md` сделаны. Дальше — по новым задачам:
перед крупным изменением — план и «ок»; после задачи — тесты только по затронутым классам (`.\mvnw.cmd test -Dtest=…`,
JAVA_HOME на JDK 21), полный прогон — в конце или по просьбе. Testcontainers поднимают `infra/db/init/01–05` сами.

## 9. Готово, когда

- Все эндпоинты продукта 1 отвечают на реальных данных после `docker compose down -v && docker compose up -d --build`.
- Формы ответов совпадают с `contracts/examples/`.
- Карта на всей области отвечает быстрее 300 мс на 200 000 строк.
- `/health` отвечает 200; без токена `/api/*` отвечает 401 (проверяет `infra/smoke.sh`).
- Фронт работает с выключенным MSW; тесты зелёные.
- Перед PR проверено локально: `docker compose up -d --build postgres core-api`, `/health`, 2–3 `curl` по контракту.

## 10. Как со мной работать

- Перед крупным изменением коротко опиши план и дождись подтверждения; мелкие правки делай сам.
- Если в ТЗ нет ответа — спроси, не придумывай (особенно по контракту, который читают другие).
- Не трогай файлы вне `core-api/` и `contracts/examples/`. Если для задачи это необходимо — остановись и скажи.
- В конце каждой задачи: что сделано, что заглушено, как проверить (2–3 `curl`) — это пойдёт в описание PR.
- **Git:** не выполнять `git add`, `git commit`, `git push`, не создавать ветки и теги без моей явной команды в этой же сессии. Если коммит нужен, объясни зачем и спроси; разрешение на один коммит не распространяется на следующие.

## 11. Контекст кейса (из описания кейса и презентации)

Хакатон ДГТУ-26, кейс Ростелекома «Экосистема коммерческого блока». Презентация — 5 минут: проблема, живая демонстрация, экономика
(время менеджеров), масштабируемость на другие регионы и отрасли.

**Критерии оценки (модуль 1 = 50 баллов):** качество обработки данных (чистота, логика) — 10; бренд-бук и адаптивность — 5; UX/UI — 10;
бизнес-инсайт — 10; техническая реализация (архитектура) — 10; экспорт в CSV/CRM — 5.

Что это значит для core-api:
- **Качество данных и логика — 10 баллов, и это в основном мы.** Фильтры должны быть строго согласованы между картой, списком и экспортом
  (один `CompanyFilterSql`). Цифры в `cells`, `companies` и `internal/companies` при одном фильтре обязаны сходиться.
- **Архитектура — 10 баллов:** изоляция схем, `/health`, конфиг из env, единый формат ошибок, Swagger — всё это видно жюри. Не срезать углы.
- **Бизнес-инсайт:** белые пятна и потенциал районов — «доп. баллы» из кейса. Поле `reason` должно читаться человеком, а не быть техническим.
- **Масштабируемость:** код не должен зашивать «Ростовская область» (регион, центр карты, список районов) — всё из БД и справочников.
- Браузеры по кейсу: Яндекс.Браузер, Firefox, Chrome (это про фронт, но ответы API должны быть стандартным JSON).
- Формат DOC для коммерческого предложения относится к модулю 3 (калькулятор) — не наша часть.

## 12. Факты о данных (из `Хакатон_2026_фактура.xlsx`, лист МОД1, 759 клиентов)

- Все 759 ИНН уникальны, регион везде «61 — Ростовская область».
- 586 из 759 — индивидуальные предприниматели (77 %), 173 — юрлица. Категории: 734 микро, 21 малых, 4 средних.
- **`employees` пустое у 601 из 759 (79 %)** → поле nullable везде; сортировка по `employees` обязательно с `NULLS LAST`; в JSON `null`, а не `0`.
- У каждого клиента заполнен либо район, либо город; «Дата исключения» пустая у всех. Статус `excluded` определяет ETL по реестру, не мы.
- Выручки в данных нет. Она либо из ФНС, либо модельная (`revenue_source`, `is_estimated`). Фильтр по выручке работает по `revenue_est`,
  и пользователю это надо показывать как оценку — это забота фронта, но API обязан честно отдавать `revenueSource` и `isEstimated`.
- Клиентов в Ростове-на-Дону 280, в Таганроге 56 — карта в городе будет плотной. Порог 1500 точек и сетка кластеров проверять на реальной плотности.
- Названия муниципалитетов в листе МОД2 («Азовский район») отличаются от МОД1 («Азовский р-н»). Нормализует ETL; в `invest/` (продукт 2) учесть,
  что связь проекта с районом идёт через `municipality_id`, а не по строке.

# ETL — загрузка данных «Радара присутствия»

etl-service — отдельный HTTP-микросервис (Python, стандартная библиотека, порт 8084). `python -m etl serve` (CMD контейнера)
поднимает API; загрузка превращает сырьё `etl.raw_*` в `core.*` одной транзакцией. Из консоли по-прежнему работают
`python -m etl load` и `python -m etl demo-project`. Конфиг из env: `DATABASE_URL`, `PORT` (8084), `INTERNAL_TOKEN`,
`AUTO_LOAD` (`if-empty` — по умолчанию: загрузить при старте, если ещё не было успешной; `always`; `never`).
Подключение к БД с повторами (30 × 2 с).

## API

| Запрос | Что делает |
| --- | --- |
| `GET /health` | без токена: `{"status":"ok","running":false}` |
| `POST /internal/etl/load` | запустить загрузку: 202; 409, если уже идёт |
| `GET /internal/etl/status` | `{"running":…, "last":{id, status, startedAt, finishedAt, details}}` |
| `POST /internal/etl/demo-project` | 201 `{projectId, municipality}` — демо для notifier |

`/internal/*` — заголовок `X-Internal-Token`. Ошибки — в общем формате `{"error":{"code","message"}}`. Во время загрузки
читатели `core.*` ждут конца транзакции (TRUNCATE держит блокировку) — перезапускать на демо не стоит.

## Блок для docker-compose.yml (PR техлиду)

```yaml
  etl:
    build: ./etl
    container_name: radar-etl
    environment:
      PORT: "8084"
      DATABASE_URL: postgresql://etl_loader:${ETL_DB_PASSWORD:-etl_dev}@postgres:5432/radar
      INTERNAL_TOKEN: ${INTERNAL_TOKEN:-internal_dev_token}
      AUTO_LOAD: if-empty
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
```

Сервис больше не «разовый»: готовность — `etl.load_run.status = 'ok'` (`GET /internal/etl/status`), а не код выхода 0.
Это меняет `infra/smoke.sh` и критерий готовности из ТЗ — согласовать с техлидом. Наружу (nginx) путь не открывать.

## Источники

| Источник | Куда |
| --- | --- |
| Таблица кейса, лист МОД1 (759 клиентов Ростелекома) | сид → `etl.raw_clients` |
| Реестр МСП ФНС, rmsp.nalog.ru, Ростовская обл. (подготовлен `tools/rmsp/prepare_rmsp.py`) | `data/rmsp_61.csv.gz` → `etl.raw_rmsp` |
| Открытые данные ФНС «доходы и расходы организаций» (необязательно) | `data/revenue_fns.csv.gz` (колонки `inn,year,income[,expense]`) → `etl.raw_revenue` |
| Лист МОД2 (инвестпроекты) | сид → `etl.raw_invest` |
| Nominatim / OpenStreetMap — центроиды районов и населённых пунктов | `data/municipalities.json`, `data/settlements.json` (собраны один раз `tools/geocode_nominatim.py`) |
| ОКВЭД (2 цифры) → отрасль | `data/okved_industry.csv` |

## Записи «Не является субъектом МСП»

В выгрузке реестра у ~56 % строк категория «Не является субъектом МСП» (статуса МСП уже нет). По умолчанию
(`NON_MSP=exclude`) такие не-клиенты не загружаются (это не рынок МСП), а клиенты из этой категории получают
`status='excluded'`. `NON_MSP=keep` возвращает прежнее поведение (все считаются действующими).
Счётчики — в `etl.load_run.details.skipped` (`non_msp_not_loaded`, `clients_non_msp_marked_excluded`).

## Статус компании

| ИНН есть в… | `is_client` | `status` | `excluded_at` |
| --- | --- | --- | --- |
| клиентах и действующем реестре | true | active | — |
| клиентах и выгрузке исключённых | true | excluded | дата из выгрузки |
| клиентах, нигде в реестре | true | excluded | — |
| только в действующем реестре | false | active | — |
| только в выгрузке исключённых | не загружается | | |

## Формулы

- **Муниципалитет:** район, иначе город → нижний регистр → `г. Название` / `Название р-н` → заглавные буквы (кроме `на`, `в`).
- **Координаты:** точка в круге вокруг центроида (радиус 0,01° населённый пункт / 0,03° город / 0,08° район):
  `r = R·√u(inn,"r")`, `φ = 2π·u(inn,"phi")`, `lat = lat0 + r·cosφ`, `lon = lon0 + r·sinφ / cos(lat0)`.
  `u(inn, salt) = int(sha256(inn+salt)[:8], 16) / 0xFFFFFFFF` — стабильно между запусками.
- **Выручка:** юрлица из ФНС — доход за последний год (`revenue_source='fns'`, рост к предыдущему году, если он есть, иначе NULL).
  Остальным — модель: `медиана × k_отрасли × exp(0.6·(u−0.5)·2)`, медиана: micro ИП 4 млн / ЮЛ 15 млн, small 250 млн,
  medium 1,2 млрд (или `employees × 3 млн`), результат обрезается границами категории (micro ≤ 120 млн, small 120–800 млн,
  medium 0,8–2 млрд; нижняя граница micro 0,5 млн — наше допущение). `revenue_source='model'`, `is_estimated=true`.
- **Рост (модель):** база по возрасту (<2 лет 25 %, 2–5 лет 12 %, >5 лет 5 %) ± 8 п. п. от хэша ИНН.
- **Потенциал и белые пятна:** `core.refresh_municipality_stats()` в БД (`infra/db/init/02_tables.sql`) — единая формула
  для ETL и core-api; пороги калибруются на реальных данных.
- **Инвестпроекты (продукт 2):** стадия — `start_year > 2026` → design, `launch_year ≤ 2026` → launch, иначе construction;
  отрасль и потребности — по ключевым словам (`data/invest_keywords.csv`, первое совпадение, слово ищется с начала
  слова), ручные правки — `data/invest_overrides.csv`. **Порядок строк важен:** стройка → агро → энергетика →
  недвижимость → производство → логистика → торговля → гостиницы/общепит → услуги — так «ЖК … Летний сад» не уходит в
  агро, а «расширение производства… строительство склада» — в логистику. Сейчас все 63 проекта получают отрасль и
  потребности; в overrides — 3 проекта, которые словами не разобрать (медцентр по названию бренда, СТО при складе,
  бывший комбикормовый цех под ремонт техники).

## Порядок первого запуска

1. Выгрузить реестр и прогнать `tools/rmsp/prepare_rmsp.py` (см. `docs/data/rmsp-instruction.md`).
2. `python etl/tools/geocode_nominatim.py --rmsp etl/data/rmsp_61.csv.gz --case infra/db/tools/case.xlsx --user-agent "..."`
   (+ `--settlements` по желанию) → закоммитить JSON.
3. `docker compose up -d --build` → контейнер `etl` завершается с кодом 0, итоговые цифры — в логе и в `etl.load_run`.
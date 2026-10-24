# 08. Продукт 2 «Инвестиционный навигатор» — контракт

Читают: Java #1 (core-api, пакет `invest/`), фронт (страница «Навигатор»), C# (экспорт проектов),
Java #2 (связанные компании, справочник услуг, **notifier — на Java, папка `notifier/`**). Примеры ответов — в [`contracts/examples/`](../../contracts/examples/)
(файлы `project*.json`, `timeline.json`, `related-companies.json`, `subscriptions.json`, `notifications.json`,
`telegram-link.json`), на них фронт делает MSW-заглушки, пока бэкенд не готов. При расхождении верить этому файлу.
Общие правила (JWT, формат ошибок, пагинация, camelCase, `null` вместо пропуска) — как в [00-common](00-common.md).

**Зачем продукт:** менеджер видит, какие инвестпроекты строятся в области, **что из услуг Ростелекома им нужно**
(по потребностям проекта) и **какие компании рядом** — потенциальные клиенты; подписывается на район / отрасль и
получает уведомление (в ленте и Telegram), когда появляется новый проект.

## Данные

| Таблица | Что | Кто заполняет |
| --- | --- | --- |
| `core.invest_project` | 63 проекта из листа МОД2: район, инициатор, годы, объём, рабочие места, `stage`, `industry`, `needs[]` | ETL (Python) |
| `core.need_offer` | потребность → услуги Ростелекома (`offers[]`) | `infra/db/init/04_need_offer.sql` (техлид) |
| `notify.*` | подписки, лента, привязка Telegram | notifier (Go) |

Координат у проекта нет — только муниципалитет. `lat`/`lon` проекта = центр муниципалитета (из `core.municipality`);
несколько проектов одного района фронт показывает одним маркером с числом.

## Справочники — в `GET /api/dictionaries` (уже есть поля `stages`, `needs`, сейчас пустые)

```json
"stages": [ { "code": "design", "name": "Проектирование" }, { "code": "construction", "name": "Строительство" },
            { "code": "launch", "name": "Запуск" } ],
"needs":  [ { "code": "it_infra", "name": "ИТ-инфраструктура и связь" },
            { "code": "apcs", "name": "АСУ ТП и промышленный интернет вещей" },
            { "code": "phys_security", "name": "Физическая безопасность" },
            { "code": "info_security", "name": "Информационная безопасность" } ]
```

## `ProjectFilter` — общий фильтр проектов

Одинаково принимают `GET /api/projects`, `GET /api/projects/timeline`, `GET /api/export/projects`, `GET /internal/projects`.
Как и у компаний: фильтр живёт в URL, множественные значения — повтором параметра, все условия через AND, неизвестный код → 400.

| Параметр | Тип | Логика |
| --- | --- | --- |
| `stage` | код, множественный | `stage IN (...)` |
| `industry` | код отрасли (те же, что у компаний), множественный | `industry IN (...)` |
| `need` | код потребности, множественный | `needs && ARRAY[...]` — есть хотя бы одна из выбранных |
| `municipalityId` | int, множественный | `municipality_id IN (...)` |
| `yearFrom`, `yearTo` | год | проект «идёт» в этот период: `start_year <= yearTo AND launch_year >= yearFrom` (пустой год проекта — не отсекаем) |
| `isKey` | `true` | только ключевые |
| `amountMin` | млн руб. | `amount_mln >= amountMin` |
| `q` | строка ≥ 2 символов | `title ILIKE %q% OR initiator ILIKE %q%` |

## core-api (Java #1)

### `GET /api/projects?<фильтр>&page=0&size=50&sort=amountMln,desc` → `{ items: Project[], page, size, total }`

Сортировки: `amountMln`, `jobs`, `startYear`, `launchYear`, `title` (`,asc|,desc`); пустые значения — в конце, затем `id`.

```ts
type Project = {
  id: number; title: string; initiator: string | null;
  municipalityId: number; municipalityName: string; lat: number; lon: number;   // центр муниципалитета
  isKey: boolean; curator: string | null;
  startYear: number | null; launchYear: number | null;
  amountMln: number | null;   // млн руб., 2 знака
  jobs: number | null;
  stage: 'design' | 'construction' | 'launch' | null; stageName: string | null;
  industry: string | null; industryName: string | null;
  needs: string[];            // коды потребностей, [] если нет
  recommendedOffers: { need: string; needName: string; offers: string[] }[];   // по needs из core.need_offer, порядок как в needs
  updatedAt: string;          // ISO-8601 UTC
};
```

### `GET /api/projects/{id}` → `Project`; нет — 404 `NOT_FOUND`.

### `GET /api/projects/timeline?<фильтр>` — таймлайн над картой

На каждый проект — событие `start` (`startYear`) и `launch` (`launchYear`), если год известен. Годы по возрастанию,
внутри года — сначала `start`, затем по `amountMln` убыв.

```json
{ "minYear": 2019, "maxYear": 2055, "total": 63,
  "years": [ { "year": 2021, "events": [
      { "projectId": 40, "type": "start", "title": "Строительство тракторного завода…", "municipalityId": 53,
        "municipalityName": "г. Ростов-на-Дону", "stage": "launch", "amountMln": 17142.1 } ] } ] }
```

`total` — число проектов под фильтром (не событий).

### `GET /internal/projects?updatedSince=<ISO-8601>&<фильтр>` — для notifier и export-service

`X-Internal-Token`, без JWT. Массив полных `Project` (без пагинации, их десятки), `updated_at > updatedSince`
(параметр необязательный), сортировка по `updatedAt` возр., затем `id`.

## core-api (Java #2) — `GET /api/projects/{id}/related-companies`

Кому продавать вокруг проекта. Ответ:

```ts
type RelatedCompanies = {
  projectId: number;
  items: (CompanyShort & { relation: 'initiator' | 'same_area_industry' })[];   // CompanyShort — как в списке компаний
  sameAreaIndustryTotal: number;   // сколько всего компаний той же отрасли в том же районе (status=active)
  radarQuery: string | null;       // строка CompanyFilter для «Открыть в радаре»: "industry=manufacturing&municipalityId=53"
};
```

- `initiator` — компания из `core.company`, у которой нормализованное название совпадает с нормализованным `initiator`
  проекта. 0 или 1 запись, первой в списке. **Нормализация** (одинаково для обеих сторон): нижний регистр, `ё → е`;
  убрать ОПФ целыми словами — «общество с ограниченной ответственностью», «(публичное|непубличное|закрытое|открытое)
  акционерное общество», «акционерное общество», «индивидуальный предприниматель», «специализированный застройщик»,
  «сельскохозяйственный производственный кооператив», «группа компаний», `ооо пао оао зао нао ао ип сз спк кфх гк`;
  все символы, кроме букв, цифр, пробела и дефиса, → пробел; схлопнуть пробелы, trim. Несколько совпадений → взять
  компанию из того же муниципалитета, что проект; если и так не одна — не показывать. Проверено на данных: однозначно
  находится **38 инициаторов из 63** (ни один из них не клиент РТ — это инсайт для слайда).
- `same_area_industry` — до 20 действующих компаний того же `industry` и `municipality_id`: сначала **не клиенты**
  (потенциальные), затем клиенты; внутри — по `revenueEst` убыв. Инициатор повторно не включается.
- У проекта нет отрасли → только инициатор, `sameAreaIndustryTotal = 0`, `radarQuery = null`.

## notifier (Java, Java #2) — подписки и уведомления

Пользователь — `sub` из JWT. Через nginx: `/api/subscriptions*`, `/api/notifications*` → notifier :8083.

### Подписки

- `GET /api/subscriptions` → `Subscription[]` (новые сверху).
- `POST /api/subscriptions` `{ industry?, municipalityId?, need?, stage? }` — хотя бы одно поле, иначе
  **400 `VALIDATION_ERROR`** (а не 422 — как во всех сервисах); неизвестный код → 400. Ответ **201** `Subscription`.
- `DELETE /api/subscriptions/{id}` → 204; чужая или нет → 404.

```ts
type Subscription = { id: number; industry: string | null; municipalityId: number | null;
                      need: string | null; stage: string | null; createdAt: string };
```

**Проект подходит подписке**, если совпадают **все** её заполненные поля: `industry =`, `municipalityId =`,
`need ∈ needs`, `stage =` — **и** проект изменён после создания подписки (`updatedAt > createdAt`): иначе новая
подписка «на Ростов» сразу завалила бы ленту всеми старыми проектами.

### Лента

- `GET /api/notifications?unread=true` → `{ items: Notification[], unreadCount: number }` — 50 последних, новые сверху
  (`unread` необязателен).
- `POST /api/notifications/{id}/read` → 204; `POST /api/notifications/read-all` → 204.

```ts
type Notification = { id: number; projectId: number; title: string; municipalityName: string | null;
                      subscriptionId: number | null; isRead: boolean; sentToTelegram: boolean; createdAt: string };
```

### Telegram

`GET /api/notifications/telegram-link` → `{ botConfigured: boolean, linked: boolean, url: string | null }`.
`url` = `https://t.me/<bot>?start=<link_token>`, `<bot>` берётся из Telegram (`getMe`); бот не настроен (`TELEGRAM_BOT_TOKEN` пуст) → `botConfigured: false`, `url: null`
— фронт показывает «Telegram не подключён на сервере», остальное работает.

### Воркер и демо

Раз в `CHECK_INTERVAL`: `GET http://core-api:8080/internal/projects?updatedSince=<lastCheckedAt>` → подходящие подписки →
`INSERT … ON CONFLICT (user_id, project_id) DO NOTHING` → Telegram, если привязан → `lastCheckedAt` = максимальный
`updatedAt` из ответа. core-api не ответил → в лог, повтор по расписанию; ручной запуск в этом случае отвечает 502.
Входящие команды бота — long polling (`getUpdates`), вебхук и белый IP не нужны.
**Демо на защите:** подписаться в интерфейсе → `docker compose exec etl python -m etl demo-project` (новый проект с
`updated_at = now()`) → `POST /internal/notifier/check` (или подождать `CHECK_INTERVAL`) → уведомление в ленте и Telegram.

## export-service (C#) — после экспорта компаний

`GET /api/export/projects?<ProjectFilter>&format=csv|bitrix` через `GET /internal/projects`. Колонки: название,
инициатор, муниципалитет, стадия, отрасль, потребности, рекомендуемые услуги РТ, годы, объём (млн руб.), рабочие места;
Bitrix — Источник = «Инвестиционный навигатор». Подробно — [06](06-csharp-export.md).

## Готово, когда

`docker compose --profile product2 up -d --build` → `PRODUCT2=1 bash infra/smoke.sh` зелёный; сценарий: «Навигатор» →
фильтр «Производство» → таймлайн и карта меняются вместе → карточка проекта показывает услуги РТ и компании рядом →
«Открыть в радаре» → радар с фильтром района и отрасли → подписка на район → `demo-project` → уведомление.

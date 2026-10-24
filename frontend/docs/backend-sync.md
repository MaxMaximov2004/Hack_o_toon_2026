# Сверка фронта с кодом бэкенда (24.10.2026)

Сверены все вызовы `src/api/endpoints.ts`, `auth/*`, `export/*` с контроллерами и DTO:
core-api (`radar/*`, `invest/*`, `related/*`, `locations/*`, `clients/*`), notifier (`subscription/*`, `notification/*`),
auth-service (`internal/handler/handler.go`), export-service (`Controllers/ExportController.cs`), маршруты nginx.

## Расхождения — исправлены во фронте

| Где | Было на фронте | Как в бэкенде | Исправление |
| --- | --- | --- | --- |
| `apiFetch`, любой 401 | ошибка подменялась на `UNAUTHORIZED «Требуется авторизация»` + редирект | auth-service: `INVALID_CREDENTIALS`, `INVALID_CODE`, истёкший mfaToken — `UNAUTHORIZED` с текстом | 401 читает тело; на `/api/auth/login` и `/2fa/verify` без редиректа → «Неверный код», поле очищается |
| вход по ссылке с фильтром | `next` терял query (`?industry=…`) | — | `next` = путь + query; принимаем только свой относительный путь |
| `Project` | `startYear`, `launchYear`, `amountMln`, `jobs`, `industry`, `curator` — всегда заданы | `invest/Project.java`: `Integer`/`Double`/`String`, бывают `null` | типы nullable; «с 2024», «—»; таймлайн не падает на `amountMln = null` (было `.toFixed` → ошибка) |
| таймлайн | `minYear`/`maxYear` — числа | `Timeline.java`: нет событий → `null`; при `yearFrom/yearTo` — только события в периоде | пустой таймлайн без падения; мок считает так же |
| `MunicipalityStats.coverage` | показывали как проценты: 0.0044 → «0.0%» | доля 0..1 (`stats.json`) | «0,44 %»; мок отдаёт долю |
| `revenueEstSum`, `reason` | число / строка | `Long` и `String`, бывают `null` | «—»; суммы через `formatMoney`: было «1837200.0 млн ₽», стало «1 837,2 млрд ₽» |
| `Subscription`, `Notification` | лишние поля, `projectTitle`/`read` | `notifier`: `title`, `isRead`, `subscriptionId`, `sentToTelegram` | типы по `notifier` (сделано на этапе 6) |
| `ProjectRelatedCompany` | урезанный тип | `RelatedCompanies.Item` = `CompanyShort` + `relation` | сделано на этапе 5 |

## Совпадает (проверено)

`/api/dictionaries`, `/api/map/cells` (`zoom` 3–18, `mode` cells/points), `/api/companies` (`page`, `size ≤ 200`,
сортировки), `/api/companies/{id}`, `/api/white-spots`, `/api/projects` (`size ≤ 200` — карта Навигатора берёт 200),
`/api/projects/timeline`, `/api/projects/{id}/related-companies`, `/api/subscriptions*`, `/api/notifications*`,
`/api/auth/login|2fa/verify|me`, `/api/export/companies?…&format=csv|bitrix` (`Content-Disposition` с `filename*`,
413 → `details.total`), имена параметров `CompanyFilter` и `ProjectFilter`, коды отраслей / потребностей / стадий.

## На стороне бэкенда — переслать владельцам

| Кому | Что |
| --- | --- |
| C# (export-service) | `GET /api/export/projects` ещё нет — кнопку «В CSV» в Навигаторе добавим, когда появится (ТЗ 11, раздел 8) |
| — | Других расхождений в бэкенде не нашёл: формы ответов совпадают с `contracts/examples/` |

Проверено чтением кода, не запуском: Docker в облачной сессии нет. Финальная проверка — на `docker compose --profile product2 up -d --build`.

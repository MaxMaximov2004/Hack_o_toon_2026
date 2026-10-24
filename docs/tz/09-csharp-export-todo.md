# 09. export-service — разбор ветки `MaxMaximov` и что доделать

**Кому:** C# (капитан). Полное ТЗ с колонками форматов — [06-csharp-export.md](06-csharp-export.md); здесь — что уже
хорошо, что мешает влить в `main` и **логика проверки JWT** по правилам остальных сервисов. Код — на твоё усмотрение.

## Что уже хорошо

- `GET /health` → `200 {"status":"ok"}` — как надо.
- Колонки CSV и Bitrix24 — ровно по 06, перевод `kind`, `revenueSource`, `sizeCategory` верный.
- UTF-8 с BOM, `ru-RU`, имя файла `radar_…csv` / `radar_bitrix_…csv`.

## Что мешает влить (по важности)

| # | Проблема | Почему важно | Что сделать |
| --- | --- | --- | --- |
| 1 | **Данные — заглушка** в коде (`GetStubCompaniesAsync`: «Ростелеком» и «Сбербанк», Москва) | В файле не то, что на экране: шаг 7 демо и смоук («строк в файле = в списке») не пройдут | Брать из core-api: `GET {CORE_API_URL}/internal/companies?{query}` с `X-Internal-Token`. Эндпоинт **уже работает** |
| 2 | **Нет `Dockerfile`** в корне `export-service/` | `docker compose` не соберёт сервис | `sdk:8.0` (publish) → `aspnet:8.0`, `EXPOSE 8082`; путь к `.csproj` внутри — любой |
| 3 | **Прямой доступ к БД** (`data/DatabaseContext`, EF, `ConnectionStrings` на таблицы `core.*` под `calc_svc`) | Нарушает правило «к соседям — только HTTP»; `calc_svc` к `core` доступа не имеет (`permission denied` — это проверяет смоук) | Удалить `data/`, пакеты EF и `ConnectionStrings`. БД экспорту не нужна |
| 4 | **Нет проверки JWT** — выгрузка всей базы без входа | Безопасность; смоук: «export отклоняет dev-токен» | По разделу «JWT» ниже |
| 5 | Формат ошибок `{ "error": "CODE", "message" }` | Фронт читает `error.code` / `error.message` | `{ "error": { "code", "message", "details" } }`, `details` — `null` или `{ "field": … }` |
| 6 | В git **23 служебных файла Visual Studio** (`.vs/`, `*.user`, `*.suo`, `*.vsidx`, `slnx.sqlite`) и профиль публикации в Docker Hub | Мусор, у каждого свой; лишний мегабайт | `git rm -r --cached export-service/**/.vs` и т. п. + `.gitignore`: `.vs/ bin/ obj/ *.user *.suo` |

## Логика выгрузки — поправить

- **Фильтр не собирать вручную.** Сейчас из параметров заново строится строка — пропадут новые параметры (`relocated`
  и др.), а `decimal` в культуре сервера может уйти как `10000000,5`. Правило: взять **исходную** query-строку, убрать
  только `format`, остальное передать в core-api как есть. Проверку фильтра делает core-api.
- **Ответы core-api пробрасывать:** 400 и 413 `TOO_LARGE` — тем же статусом и телом (фронт покажет «сузьте фильтр,
  N компаний»); таймаут 5 с, 5xx, нет соединения → **502 `UPSTREAM_UNAVAILABLE`**.
- **Числа без разделителя тысяч.** Сейчас `ToString("N2")` даёт `18 500 000,00` с неразрывными пробелами — Excel
  примет за текст. Выручка — целое `18500000`, рост — `12,5` (`ru-RU`, без группировки).
- **Потоком, не в `MemoryStream`:** до 100 000 строк. Читать ответ core-api по мере прихода
  (`ResponseHeadersRead` + `DeserializeAsyncEnumerable`) и сразу писать строки в ответ.
- `Content-Disposition` — с русским именем по RFC 5987: `attachment; filename="radar_2026-10-24.csv";
  filename*=UTF-8''radar_2026-10-24.csv`. Дата — по UTC или Москве, не по часовому поясу контейнера.
- Убрать `UseHttpsRedirection` (TLS снимает nginx, внутри только http) и `AllowAll`-CORS (фронт с API на одном домене).
- Конфиг — только из env (`CORE_API_URL`, `AUTH_JWKS_URL`, `INTERNAL_TOKEN`, `ASPNETCORE_URLS`), без значений по
  умолчанию с `localhost` и тестовым токеном в `appsettings.json`.

## JWT — правила, одинаковые во всех сервисах

Так уже проверяют core-api (Java) и notifier (Java); auth-service (Go) выдаёт токены именно под эти правила.

**Где нужен токен:** `/api/export/**` — да; `/health` — нет. Ролей для экспорта не нужно — любой вошедший.

**Откуда ключ:**
1. Токен — из заголовка `Authorization: Bearer <accessToken>`.
2. Ключи проверки — JWKS по `AUTH_JWKS_URL` (`http://auth-service:8081/internal/auth/jwks`), выбор ключа — по `kid`
   из заголовка токена.
3. JWKS запрашивать **лениво** — при первом запросе с токеном, не при старте (auth-service может подниматься дольше).
   Кэш 10 минут. Пришёл неизвестный `kid` — перезапросить JWKS один раз (auth-service мог сменить ключ).

**Токен принимаем, только если всё верно:**

| Проверка | Правило |
| --- | --- |
| Алгоритм | только **RS256** (токены `none`, `HS256` — отклонять) |
| Подпись | верна ключом из JWKS с тем же `kid` |
| Срок | `exp` не истёк (допуск часов до 60 с) |
| Издатель | `iss` = **`radar-auth`** |
| Второй фактор | в claim **`amr`** есть **`"otp"`** (claim — массив, напр. `["pwd","otp"]`; токен шага 2FA с `["pwd"]` не принимать) |
| Аудитория | не проверяем (`aud` нет) |

**Подсказки по .NET (без деталей):** стандартный JwtBearer умеет всё это настройками — `ValidIssuer`,
`ValidateAudience = false`, `ValidAlgorithms = RS256`, ключи через resolver/менеджер конфигурации по JWKS-адресу.
Две ловушки: (1) отключить переименование claim'ов (`MapInboundClaims = false`), иначе `amr` придёт под другим именем;
(2) `amr` — массив, проверять «содержит otp», а не «равен».

**Ответы — в общем формате:**

| Ситуация | Код | Тело |
| --- | --- | --- |
| нет заголовка `Authorization` | 401 | `UNAUTHORIZED`, «Требуется вход: передайте заголовок Authorization: Bearer <accessToken>» |
| токен плохой / истёк / без `otp` / чужой `iss` | 401 | `UNAUTHORIZED`, «Токен недействителен или истёк — войдите заново» |
| auth-service не ответил за 5 с при запросе JWKS | 502 | `UPSTREAM_UNAVAILABLE`, «Сервис авторизации недоступен — повторите позже» |

Причину отказа (какая именно проверка не прошла) — **только в лог**, клиенту не объяснять. К 401 — заголовок
`WWW-Authenticate: Bearer`.

**Как проверить без auth-service** (`contracts/dev-keys/README.md`):

```bash
docker compose --profile auth-stub up -d --build postgres etl core-api auth-stub export-service nginx
T=$(bash contracts/dev-keys/mint-token.sh)
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $T" "localhost/api/export/companies?client=ours"   # 200
curl -s -o /dev/null -w "%{http_code}\n" "localhost/api/export/companies"                                              # 401
for v in "NO_OTP=1" "ISS=evil" "TTL=-60"; do
  T=$(env $v bash contracts/dev-keys/mint-token.sh)
  curl -s -o /dev/null -w "$v -> %{http_code}\n" -H "Authorization: Bearer $T" "localhost/api/export/companies"      # 401
done
```

С настоящим auth-service (без `auth-stub`) dev-токен должен давать **401** — это проверяет смоук.

## Готово, когда

1. В `main`: `export-service/Dockerfile`, без `.vs/ bin/ obj/`, блок `export-service` в `docker-compose.yml` раскомментирован.
2. `docker compose up -d --build` → `bash infra/smoke.sh`: `/healthz/export` 200, «экспорт в Bitrix24» 200 с именем
   файла, **строк в экспорте = в списке**, «export отклоняет dev-токен» 401.
3. Кнопки «CSV» и «В CRM» на сайте скачивают ровно то, что на экране; Excel открывает без кракозябр, суммы — числа.

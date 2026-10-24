# frontend/ — Радар присутствия (хакатон Ростелекома, осень 2026)

Ты работаешь только в папке `frontend/`. Остальные папки (`core-api/`, `auth-service/`, `export-service/`, `etl/`, `infra/`,
`docker-compose.yml`) — чужие, их не трогаем; если нужна правка там — пишем, что именно попросить у владельца.
Полное ТЗ: `../docs/tz/01-frontend.md`, общий контракт: `../docs/tz/00-common.md`, формы ответов: `../docs/tz/02-java-1-core-api.md`,
вход: `../docs/tz/05-go-auth.md`, задача со звёздочкой: `../docs/tz/07-star-actual-location.md`. При расхождении — верить ТЗ.

## Что делаем

Продукт 1 — «Радар присутствия»: карта Ростовской области «как выбор ПВЗ» — кластеры компаний двумя цветами (наши /
не наши), фильтры, белые пятна, список справа, синхронный с окном карты, карточка компании, экспорт CSV и Bitrix24,
вход с 2FA, фирменный стиль, работа на телефоне. Продукт 2 («Навигатор») — только после зелёной сборки продукта 1.

Оценка жюри (1 модуль = 50 баллов): данные 10, **бренд-бук и адаптивность 5**, **UX/UI 10**, бизнес-инсайт 10,
архитектура 10, **экспорт 5**. Защита — 5 минут живого демо, часто с телефона.

## Стек и сборка

- React 18 + TypeScript + Vite, React Router, TanStack Query, MapLibre GL, MSW для заглушек.
- Обязательно: `package.json`, `package-lock.json`, скрипт `build` → результат в `dist/`.
  Образ собирает `infra/nginx/Dockerfile` (контекст — корень репо): `npm ci && npm run build`, `dist/` → nginx.
- Запросы только относительные: `/api/...`, без хоста. Никакого `localhost` в коде.
- `vite.config.ts`: dev-прокси `/api` → `http://localhost:80` (nginx из `docker compose up`).
- `VITE_USE_MOCKS=true|false`; в образе всегда `false` (по умолчанию — false, mocks включаются только в `.env.development.local`).
- Перед каждым PR: `npm run build` без ошибок TS, затем из корня `docker compose up -d --build nginx` и проверка в браузере.
- Ветка `feat/frontend-<что>`, в PR — только `frontend/`. В описании: что готово, что заглушено, как проверить.

## Бренд (гайдлайн Ростелекома для партнёров/дилеров 2024)

```css
:root {
  --rt-purple: #7700FF;   /* основной; НАШИ клиенты на карте */
  --rt-orange: #FF4F12;   /* акцент; НЕ НАШИ (потенциальные) */
  --rt-black:  #101828;   /* текст */
  --rt-white:  #FFFFFF;
  --rt-blue:     #749FD6; /* доп., ≤10% площади */
  --rt-lavender: #E8D2ED; /* доп., ≤10% — подложки, выделение */
  --rt-cool-grey:#E3E8EC; /* доп., ≤10% — фон панелей; база для серого «исключённых» */
  --rt-gray: #9AA4B2;     /* исключённые из реестра — выведен из cool grey, сверить контраст */
}
```

- Пропорция: оранжевого не больше 30% относительно фиолетового. Оранжевый — акцент, не заливка больших площадей.
  Доп. цвета — не больше 10% каждый. Цвета вне палитры не использовать (кроме нейтральных серых для UI и красного для ошибок).
- Фон — белый или светло-серый. Шапка — предпочтительно фиолетовая заливка, логотип и текст белые.
- Шрифт — Rostelecom Basis (публично не распространяется; если куратор не даст файлы — `Arial, sans-serif`, как разрешает гайдлайн).
  Заголовки Medium/Bold, line-height 0.9–1.05; текст Regular, line-height 1.15; Light — только для юр. текста и только капсом.
- Логотип не искажать и не обрезать; favicon — только знак без текста.
- Пластика со слайдов кейса: крупные скруглённые карточки (радиус ~24px), тонкая фиолетовая обводка, диагональный срез
  фиолетового блока, оранжевые разделители «|». Брать как акценты, не перегружать.

## Статусы компаний и цвета

| kind | Смысл | Цвет | По умолчанию |
| --- | --- | --- | --- |
| `ours` | действующий клиент РТ (`isClient`, `status=active`) | фиолетовый | показан |
| `others` | потенциальный: в реестре МСП, не клиент | оранжевый | показан |
| `excluded` | клиент, исключённый из реестра МСП | серый | скрыт (`status=all`) |

В интерфейсе писать «исключён из реестра МСП», а не «закрылся» (мог вырасти из МСП или не сдать отчётность).

## Авторизация (auth-service, Go)

```
/login → POST /api/auth/login {email,password}
         401 INVALID_CREDENTIALS → «Неверный email или пароль»
         200 {mfaToken, mfaSetupRequired, otpauthUrl?, qrPngBase64?}
/login/2fa (mfaToken только в памяти)
   mfaSetupRequired → <img src="data:image/png;base64,…"> + «Отсканируйте в Google/Яндекс Аутентификаторе»
   6 цифр: inputmode="numeric", autocomplete="one-time-code", автосабмит на 6-й
   → POST /api/auth/2fa/verify {mfaToken, code}
       401 INVALID_CODE → «Неверный код», очистить поле
       429 TOO_MANY_ATTEMPTS → «Слишком много попыток», на /login
       200 {accessToken, expiresIn, user:{id,email,fullName,roles}} → сохранить → на next или /
GET /api/auth/me → user
```

- Токен: память + `sessionStorage` (все обращения в `try/catch`).
- Один `apiFetch()`: ставит `Authorization: Bearer`; на любой 401 — стереть токен и `/login?next=…`;
  ошибки нормализует в `{ code, message, details }`; 502 → «Сервис временно недоступен».
- Демо: `demo@rt.ru` / `Demo2026!`, TOTP-секрет `JBSWY3DPEHPK3PXP`. Админ: `admin@rt.ru` / `Admin2026!` (покажет QR).
- Роль `admin` в `user.roles` открывает «Обновить список клиентов».

## Ошибки — единый формат

`{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "field": "revenueMin" } } }`
Коды: 400 VALIDATION_ERROR, 401 UNAUTHORIZED/INVALID_CREDENTIALS/INVALID_CODE, 403 FORBIDDEN, 404 NOT_FOUND,
409 CONFLICT/EMAIL_TAKEN, 413 TOO_LARGE (`details.total`), 429 TOO_MANY_ATTEMPTS, 502 UPSTREAM_UNAVAILABLE, 500 INTERNAL_ERROR.

## Фильтр = URL (главное архитектурное правило)

Источник правды — query-строка. Одна функция `filterToQuery()` для карты, списка и экспорта, чтобы экспорт
гарантированно совпадал с экраном. Множественные значения — повтором параметра: `?industry=trade&industry=logistics`.

| Параметр | Значения |
| --- | --- |
| `client` | `all` (деф.) / `ours` / `others` |
| `status` | `active` (деф.) / `excluded` / `all` |
| `industry` | мульти: `agro energy manufacturing construction trade logistics hospitality it realestate services other` |
| `revenueMin`, `revenueMax` | рубли/год (в UI вводим млн, умножаем на 1 000 000) |
| `minLat maxLat minLon maxLon` | окно карты — все четыре или ни одного, округление до 4 знаков |
| `municipalityId` | мульти, int |
| `sizeCategory` | мульти: `micro small medium` |
| `growthMin` | % |
| `isNew` | `true` |
| `q` | ≥ 2 символов (название или начало ИНН) |
| `relocated` | `true` (только задача со звёздочкой) |

- Контролы → URL через `replace`, дебаунс 300 мс. Движение карты → bbox после `moveend`, дебаунс 400 мс.
- Ключ кэша TanStack Query = эта строка (+ `zoom` для карты). `placeholderData: keepPreviousData`, старые данные — полупрозрачно.
- Дефолты (`client=all`, `status=active`) в URL не писать — короче ссылки и кэш-ключи.

## Эндпоинты и формы

**`GET /api/dictionaries`** — один раз при старте, `staleTime: Infinity`:
`{ industries:[{code,name}], municipalities:[{id,name,kind:"city"|"district",lat,lon}], sizeCategories:[{code,name}], stages:[], needs:[] }`

**`GET /api/map/cells?<фильтр>&zoom=<int 3..18>`** — сервер сам выбирает режим (≤ 1500 компаний → точки):
```json
{ "mode": "cells", "cellDeg": 0.656, "total": 182344,
  "cells": [ { "lat": 47.2311, "lon": 39.7102, "total": 5120, "ours": 210, "others": 4910, "excluded": 0 } ] }
{ "mode": "points", "total": 312, "points": [ { "id": 101, "lat": 47.1102, "lon": 39.4211, "kind": "ours" } ] }
```
- cells: кружок размером ~ `log(total)`, число внутри; обводка — кольцо из дуг `ours/total` фиолетовым, `others/total`
  оранжевым, `excluded` серым. При `client=ours|others` — один цвет. Клик → `flyTo` центр, зум +2.
- points: маркер цветом по `kind`, клик → карточка. Выбранная компания подсвечена.
- Старт: центр `[47.6, 40.8]` (lat, lon — в MapLibre это `[40.8, 47.6]`!), зум 7. Подложка — растровые тайлы OSM;
  если на площадке их режут — фолбэк без подложки.
- Легенда всегда видна: фиолетовый — наши, оранжевый — не наши, серый — исключены из реестра МСП.

**`GET /api/companies?<фильтр+bbox>&page=0&size=50&sort=revenueEst,desc`** → `{ items: CompanyShort[], page, size, total }`.
Сортировки: `name`, `revenueEst`, `revenueGrowthEst`, `employees`, `registeredAt` (`,asc|,desc`).
```ts
type CompanyShort = {
  id: number; inn: string; name: string;
  industry: string; industryName: string; okvedCode: string; okvedName: string;
  municipalityId: number; municipalityName: string; settlement: string | null;
  lat: number; lon: number; sizeCategory: 'micro'|'small'|'medium'; employees: number | null;
  revenueEst: number | null; revenueGrowthEst: number | null;
  revenueSource: 'fns'|'model'; isEstimated: boolean;
  isClient: boolean; status: 'active'|'excluded'; kind: 'ours'|'others'|'excluded';
  excludedAt: string | null; isNew: boolean; registeredAt: string;
  relocated?: boolean; // звёздочка
};
type Company = CompanyShort & {
  ogrn: string; subjectType: 'ip'|'legal'; phone: string | null; email: string | null; website: string | null;
  hasLicenses: boolean; isInnovative: boolean; isSocial: boolean;
};
```
- «Найдено: N» из `total`. Пусто → «В этой области ничего нет — отдалите карту или ослабьте фильтры».
- Бейдж «оценка» при `isEstimated`; источник выручки в карточке: `fns` → «ФНС», `model` → «оценка».

**`GET /api/companies/{id}`** → `Company`; 404 → «Компания не найдена». ИНН — с кнопкой копирования.

**`GET /api/municipalities/stats?industry=all`** → массив:
`{ municipalityId, name, kind, lat, lon, industry, companies, clients, excludedClients, coverage, newShare, revenueEstSum, potentialScore (0..100), isWhiteSpot, reason }`
Слой «Потенциал»: кружок/заливка района по `potentialScore`; клик → панель района (название, действующих компаний,
наших клиентов, доля охвата, исключённых, суммарная выручка, потенциал, кнопка «Показать компании района» → `municipalityId`).

**`GET /api/white-spots?industry=all&limit=10`** → `[{ municipalityId, name, lat, lon, potentialScore, companies, clients, reason }]`
Оранжевая пунктирная обводка/подсветка района, в тултипе — `reason`.

**`GET /api/export/companies?<filterToQuery()>&format=csv|bitrix`** (C#) — `fetch` с токеном → `blob` → скачивание,
имя из `Content-Disposition` (сначала `filename*=UTF-8''…`, потом `filename=`). Перед скачиванием — «Будет выгружено N компаний»
(из `total` списка). 413 → «Слишком много, сузьте фильтр (N компаний)».

**`POST /api/clients/import`** (admin) — `multipart/form-data`: `file` (CSV ≤ 10 МБ), `mode=append|replace` →
`{ rows, matched, notFound: string[], mode, whiteSpots }`. После успеха — инвалидировать карту, список, статистику, белые пятна.

## Экран и UX

- Шапка: логотип, «Радар присутствия» / «Навигатор» (неактивен до продукта 2), пользователь, «Выйти».
- Главный переключатель **Наши / Не наши / Все** — всегда на виду.
- Панель фильтров: отрасль (мультиселект), выручка от–до в млн, район/город (мультиселект с поиском), категория, рост от %,
  «Только новые», поиск по названию/ИНН, «Показывать исключённых из реестра», «Сбросить».
- Пресет «Исключённые клиенты» → `client=ours&status=excluded` (список на чистку CRM). Цифра «N из 759 клиентов исключены
  из реестра» — заметно, это идёт на слайд.
- Брейкпоинты: телефон < 768 (карта на весь экран, вкладки Карта/Список, фильтры — нижняя выезжающая панель),
  планшет 768–1279, десктоп ≥ 1280 (фильтры | карта | список). Проверять Chrome, Firefox, Яндекс.Браузер.
- Состояния: скелетоны, тосты с `error.message`, пустые состояния с подсказкой, что сделать.
- Тач-цели ≥ 44px, контраст текста AA.

## Демо-сценарий (по нему проверяем готовность)

1. Вход `demo@rt.ru` → код → карта области с кластерами (доля наших/не наших).
2. «Логистика», выручка 10–100 млн → кластеры и список меняются вместе.
3. «Только не наши» → где потенциальные; «Все» → два цвета.
4. Приближаем Азов → кластеры распадаются на точки, список — только то, что в окне.
5. «Белые пятна» → подсвечены районы, в подсказке — почему.
6. «Показать исключённых» → серые точки; «N из 759 клиентов исключены из реестра».
7. «В CRM» → скачался файл для Bitrix24 ровно с тем, что на экране.
8. Всё то же на телефоне.

Готово, когда сценарий проходит на телефоне и в трёх браузерах на настоящем API (MSW выключен), в образе nginx после
`docker compose up -d --build`, а карта всей области открывается быстрее 1 секунды.

## Заглушки, пока бэкенд не готов

MSW-хендлеры на все эндпоинты выше; данные — из `../contracts/examples/*.json` (их кладёт Java #1:
`dictionaries.json companies.json company.json cells.json points.json stats.json white-spots.json`).
Пока их нет — свои фикстуры строго по формам выше, в `src/mocks/fixtures/`. Мок `map/cells` должен уметь
переключаться в `points` при маленьком `total`, чтобы проверять приближение. Мок логина принимает любой 6-значный код.

## Структура (ориентир)

```
src/
  api/        apiFetch.ts, types.ts, endpoints.ts (по функции на эндпоинт), queryKeys.ts
  auth/       AuthProvider, RequireAuth, LoginPage, TwoFactorPage
  filters/    useFilter (URL ↔ объект), filterToQuery.ts, FilterPanel, ClientToggle
  map/        RadarMap, clusterMarker (SVG-кольцо), layers (points, potential, white spots), Legend
  list/       CompanyList, CompanyRow, Sort
  company/    CompanyCard (drawer), DistrictPanel
  export/     ExportButtons, downloadBlob.ts, ImportClientsDialog
  ui/         Button, Chip, Badge, Toast, Skeleton, BottomSheet, Tabs
  styles/     tokens.css (бренд), global.css
  mocks/      browser.ts, handlers.ts, fixtures/
```

## Подводные камни

- MapLibre принимает `[lon, lat]`, а API отдаёт `lat`, `lon` — не перепутать.
- bbox округлять до 4 знаков и отправлять только после `moveend`, иначе кэш и бэкенд захлебнутся.
- Список и экспорт — одна и та же строка фильтра, включая bbox. Не собирать query вручную в разных местах.
- `sessionStorage` может бросить исключение (приватный режим) — оборачивать.
- `mockServiceWorker.js` лежит в `public/`, но регистрируется только при `VITE_USE_MOCKS=true`.

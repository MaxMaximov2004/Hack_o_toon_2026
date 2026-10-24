# 12. Фронт — что осталось до полного модуля 2 (и хвосты модуля 1)

**Кому:** фронт. Полное ТЗ экрана — [11-frontend-navigator.md](11-frontend-navigator.md), формы ответов —
[08-product2-contract.md](08-product2-contract.md) и `contracts/examples/`. Здесь — **что именно не сделано**,
по приоритету, с привязкой к местам в коде.

## Что уже сделано (в `main`)

Маршрут `/navigator` (ленивая загрузка), вкладки в шапке, фильтр проектов в URL (`useProjectFilter`,
`projectFilterToQuery`), список (`ProjectList`), таймлайн (`ProjectTimeline`), карта районов (`ProjectMap` —
маркеры строятся из `/api/projects`, группировка в `projects/groupByMunicipality.ts`), цвета стадий, формат сумм.

## Что не сделано — функции API уже есть в `api/endpoints.ts`, но нигде не вызываются

`getProject`, `getProjectRelatedCompanies`, `getSubscriptions`, `createSubscription`, `deleteSubscription`,
`getNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `getTelegramLink`. Бэкенд всех эндпоинтов
работает в `main` — проверять на настоящем API (`docker compose --profile product2 up -d --build`).

---

## П1. Карточка проекта — главный экран модуля 2 (по жюри: бизнес-инсайт)

**Где:** `pages/NavigatorPage.tsx` уже хранит `selectedProjectId` (клик в списке, на таймлайне). Новый компонент
`projects/ProjectCard.tsx` — выезжающая панель, как `company/CompanyCard.tsx` (взять ту же разметку и стили).

1. `GET /api/projects/{id}` (`getProject`) → заголовок, инициатор, район, стадия (чип цвета стадии), годы
   «2024–2028», объём (`formatMoney`), рабочие места, куратор, значок «Ключевой». 404 → «Проект не найден».
2. **Блок «Что предложить Ростелекому»** — `recommendedOffers`: по каждой потребности `needName` заголовком и
   список `offers`. Акцентно: лавандовая подложка (`--rt-lavender`), фиолетовый заголовок. Это то, что жюри должно
   увидеть первым.
3. **Блок «Компании рядом»** — `GET /api/projects/{id}/related-companies` (`getProjectRelatedCompanies`), грузить
   при открытии карточки:
   - `relation === 'initiator'` — первым, бейдж «Инициатор проекта» (`ui/Badge`);
   - остальные — до 20 строк: название, цвет по `kind` (как точки в радаре), выручка + бейдж «ФНС» / «оценка»;
     клик → карточка компании (`CompanyCard` уже есть);
   - строка «Всего в районе по отрасли: {sameAreaIndustryTotal}»;
   - кнопка **«Открыть в радаре»** → `navigate('/?' + radarQuery)` — радар сам поднимет фильтр из URL
     (`industry`, `municipalityId` он уже понимает). `radarQuery === null` → кнопку не показывать.
4. Кнопка **«Подписаться на такие проекты»** → `createSubscription({ industry, municipalityId })` проекта →
   тост «Подписка оформлена»; ответ 400 → тост с `error.message`.

**Готово, когда:** клик по проекту в списке, на таймлайне и по маркеру → карточка; у «Строительство тракторного
завода» видны АСУ ТП и ИТ-инфраструктура; у проекта 31 первая строка — «АО Ростовский порт» с бейджем
«Инициатор»; «Открыть в радаре» открывает радар с фильтром «Логистика · г. Ростов-на-Дону».

## П2. Уведомления и подписки

**Колокольчик** в `ui/AppHeader.tsx` (рядом с именем пользователя; на телефоне — тоже виден):

- `useQuery(['notifications'], getNotifications, { refetchInterval: 60_000, refetchOnWindowFocus: true })` →
  кружок с `unreadCount`, если > 0.
- Клик → выпадающий список последних уведомлений: название, район, время («5 мин назад»); непрочитанные — жирным.
  Клик по уведомлению → `markNotificationRead(id)` → переход в `/navigator` и открыть карточку `projectId`.
  «Прочитать все» → `markAllNotificationsRead()`. После мутаций — `invalidateQueries(['notifications'])`.
- Пусто → «Уведомлений нет. Подпишитесь на проекты в Навигаторе».

**Экран «Подписки»** — маршрут `/subscriptions` (или вкладка в `ui/ProfileMenu`):

- `getSubscriptions()` → **массив** (тип `SubscriptionsResponse = Subscription[]` уже поправлен). Каждая подписка
  — человеческим текстом через справочники: «Транспорт и логистика · г. Ростов-на-Дону», «Физическая безопасность ·
  Строительство». «Отписаться» → `deleteSubscription(id)`.
- Форма «Новая подписка»: отрасль, район, потребность, стадия (селекты из `/api/dictionaries`); все пустые → кнопка
  неактивна; 400 → `error.message`.
- **Telegram** — `getTelegramLink()` → `{ botConfigured, linked, url }`:
  `botConfigured === false` → серым «Telegram не подключён на сервере»;
  `linked === false` → кнопка «Подключить Telegram» → `window.open(url)`;
  `linked === true` → «Уведомления приходят в Telegram ✓».

**Готово, когда:** подписка «Логистика» → демонстратор выполняет `docker compose exec etl python -m etl demo-project`
и ручную проверку notifier (команда — `docs/tz/10-java-todo.md`, раздел 1) → на колокольчике «1» → клик →
карточка «Демо: строительство логистического центра». Сейчас уведомление в ленте не видно — только через API.

## П3. Импорт клиентов (админ) — модуль 1, бэкенд готов

Кнопка **«Обновить список клиентов»** в радаре — только если `user.roles` содержит `admin` (`useAuth()`).

- Диалог: выбор CSV (до 10 МБ, проверить размер до отправки), режим «Добавить» (`append`) / «Заменить» (`replace`).
- `POST /api/clients/import`, тело `FormData` с полями `file` и `mode`. **`apiFetch` выставляет JSON-заголовок
  только для строкового тела — для `FormData` браузер сам поставит `multipart/form-data` с границей, ничего не
  указывать.** Новая функция `importClients(file, mode)` в `endpoints.ts`.
- Ответ `{ rows, matched, notFound, mode, whiteSpots }` → «Строк в файле: 41, отмечено клиентами: 40, не найдено:
  1 (0000000000). Белых пятен теперь: 2». 400 → `error.message`; 403 → «Нужна роль администратора».
- После успеха — `invalidateQueries` для `['map']`, `['companies']`, `['companies-count']`, `['municipality-stats']`,
  `['white-spots']`, `['excluded-clients-count']`, `['company']` — карта и белые пятна пересчитаются.

**Готово, когда:** админ загружает CSV с ИНН компаний Целинского района → белое пятно «Целинский р-н» исчезает
с карты без перезагрузки страницы.

## П4. «Где работает» — задача со звёздочкой, бэкенд готов (фильтр `relocated` и чип у вас уже есть)

В `company/CompanyCard.tsx` — новая секция **«Где работает»** (после «Основной информации»):

- `GET /api/companies/{id}/locations` → `{ registered, actual[], relocated }` (`contracts/examples/locations.json`):
  «Зарегистрирована: Сальский р-н, г. Сальск»; фактические места — район или регион, адрес, источник
  (`manager` → «менеджер», `crm` → «CRM», `egrul` → «ЕГРЮЛ»), уверенность «80 %», комментарий.
- Кнопка **«Указать фактическое место»** → форма: район/город из `dictionaries.municipalities` **или** «Другой регион»
  (текстовое поле → `regionName`), адрес, комментарий → `POST /api/companies/{id}/locations` (201) → обновить секцию
  и `invalidateQueries(['companies'])`. 400 (неизвестный район) → `error.message`.
- У своего места — «Удалить» → `DELETE /api/companies/{id}/locations/{locationId}`.
- В списке компаний — значок «работает в другом месте» при `relocated === true` (поле уже есть в `CompanyShort`).
- На карте радара у выбранной компании с фактическим местом — пунктир от точки регистрации к фактическому месту
  (координаты — `registered` и `actual[].lat/lon`; `lat === null` — линию не рисовать).

**Готово, когда:** сценарий из `07`: ИП из Сальского р-на → «Указать фактическое место» → г. Азов → компания
находится по фильтру «Работает не там, где зарегистрирован», на карте пунктир Сальск → Азов.

## П5. Порядок в коде

`npm run lint` сейчас даёт 20 замечаний (`any` в моках, `prefer-const` в `SmartSearch`, `CompanyList`, `RadarMap`,
`AuthProvider`, `scripts/generate-projects.ts`). Сборку не ломают, но скрипт `lint` с `--max-warnings 0` красный —
поправить при случае.

## Как проверять перед пушем

```bash
npm run build && npx vitest run                        # типы и тесты
cd .. && docker compose --profile product2 up -d --build nginx   # сборка образа — как у всех
```

Открывать **http://localhost/navigator на настоящем API** (MSW выключен) — моки уже раз скрыли, что карта ходила
в несуществующий эндпоинт. Если мок нужен для новой функции — форма ответа строго как в `contracts/examples/`.

## Модуль 3

Экран калькулятора — после ТЗ модуля 3 (готовится). Новая папка `src/calc/`, ссылка в шапке появится, когда экран
готов; существующие экраны модулей 1–2 не трогать.

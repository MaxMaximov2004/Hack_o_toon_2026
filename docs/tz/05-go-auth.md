# 05. Go — auth-service (продукт 1) и notifier (продукт 2)

**Владелец:** Go-разработчик. **Папки:** `auth-service/` (продукт 1), `notifier/` (продукт 2).
**auth-service:** порт 8081, схема `auth`, пользователь `auth_svc`. Таблицы `auth.users` и `auth.mfa_sessions`
уже созданы в `infra/db/init/02_tables.sql` — из кода их не создавать и не мигрировать.
**Стек:** Go 1.22+, `chi` (или `gin`), `pgx/v5`, `golang-jwt/jwt/v5`, `pquerna/otp`, `golang.org/x/crypto/bcrypt`.
**Dockerfile:** multi-stage `golang:1.22-alpine` → `alpine:3.20` (или distroless), бинарник статически (`CGO_ENABLED=0`).

Переменные окружения (как в `docker-compose.yml`): `PORT`, `DATABASE_URL`, `JWT_KEY_PATH`, `ACCESS_TOKEN_TTL` (8h),
`MFA_TOKEN_TTL` (5m), `INTERNAL_TOKEN`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`, `DEMO_TOTP_SECRET`,
`ADMIN_USER_EMAIL`, `ADMIN_USER_PASSWORD`.

## Что происходит при старте

1. **Подключение к БД** с повторами: 30 попыток раз в 2 с, потом выход с ошибкой.
2. **Ключ подписи.** Если файла `JWT_KEY_PATH` нет — сгенерировать RSA 2048 и сохранить туда (том `auth-keys`
   переживает перезапуски, поэтому токены не протухают при рестарте). `kid` = первые 16 символов base64url от
   SHA-256 публичного ключа в DER.
3. **Сид пользователей** (upsert по email, пароль хэшируется bcrypt cost 10):
   - демо: `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`, `roles={manager}`, `totp_secret = DEMO_TOTP_SECRET`,
     `totp_enabled = true` — секрет заранее добавлен в аутентификатор докладчика, вход без QR;
   - админ: `ADMIN_USER_EMAIL` / `ADMIN_USER_PASSWORD`, `roles={admin,manager}`, `totp_secret = NULL` —
     при первом входе покажет QR (так на защите можно показать и привязку 2FA).

## Эндпоинты

### `POST /api/auth/login` — шаг 1, пароль

Запрос `{ "email": "demo@rt.ru", "password": "Demo2026!" }`. Ответ 200:

```json
{ "mfaToken": "eyJ…", "mfaSetupRequired": false }
```

Первый вход пользователя без 2FA (`mfaSetupRequired: true`) — дополнительно:

```json
{ "mfaToken": "eyJ…", "mfaSetupRequired": true,
  "otpauthUrl": "otpauth://totp/Radar%20RT:admin@rt.ru?secret=…&issuer=Radar%20RT",
  "qrPngBase64": "iVBORw0KGgo…" }
```

**Логика:**

1. Email в нижний регистр, trim. Найти пользователя. Нет пользователя **или** пароль не совпал (`bcrypt.CompareHashAndPassword`)
   → 401 `INVALID_CREDENTIALS` с одинаковым текстом «Неверный email или пароль» (не раскрывать, что email существует).
   Если пользователя нет — всё равно выполнить bcrypt по фиктивному хэшу, чтобы время ответа не выдавало.
2. Если `totp_enabled = false`:
   - `totp_secret` пуст → `totp.Generate({Issuer: "Radar RT", AccountName: email})`, сохранить `totp_secret`
     (без включения);
   - отдать `otpauthUrl` и QR: `key.Image(200, 200)` → PNG → base64; `mfaSetupRequired = true`.
3. Создать сессию 2FA: `id = uuid`, `INSERT INTO mfa_sessions (id, user_id, expires_at) VALUES (…, now() + MFA_TOKEN_TTL)`.
4. `mfaToken` — JWT RS256 тем же ключом: `iss="radar-auth"`, `sub=<user id>`, `typ="mfa"`, `jti=<id сессии>`,
   `amr=["pwd"]`, `exp = now + 5 мин`. Такой токен **не принимается** другими сервисами (нет `otp` в `amr`).

### `POST /api/auth/2fa/verify` — шаг 2, код

Запрос `{ "mfaToken": "eyJ…", "code": "123456" }`. Ответ 200:

```json
{ "accessToken": "eyJ…", "expiresIn": 28800,
  "user": { "id": 1, "email": "demo@rt.ru", "fullName": "Демо Менеджер", "roles": ["manager"] } }
```

**Логика:**

1. Проверить `mfaToken`: подпись, `exp`, `typ == "mfa"`. Иначе 401 `UNAUTHORIZED`.
2. `SELECT … FROM mfa_sessions WHERE id = jti FOR UPDATE`: нет, `used`, истекла или `attempts ≥ 5` → 401 `UNAUTHORIZED`.
3. Код: ровно 6 цифр, иначе 400. Проверка `totp.ValidateCustom(code, secret, now, {Period: 30, Skew: 1, Digits: 6, Algorithm: SHA1})`
   — допускаем соседний 30-секундный шаг (часы телефона могут отставать).
4. Неверно → `attempts = attempts + 1`; стало 5 → `used = true` и 429 `TOO_MANY_ATTEMPTS`; иначе 401 `INVALID_CODE`.
5. Верно → `used = true`; если `totp_enabled = false` — включить (`true`): 2FA привязана.
6. Выдать accessToken: `iss="radar-auth"`, `sub`, `email`, `name`, `roles`, `amr=["pwd","otp"]`, `iat`, `exp = now + 8 ч`, `jti`, заголовок `kid`.

### `GET /api/auth/me`

JWT обязателен (проверяет сам auth-service тем же ключом и тем же правилом про `amr`). Ответ — объект `user` как выше.

### `POST /api/auth/register` — только роль `admin`

`{ "email", "password", "fullName" }` → 201 `user`; email занят → 409 `EMAIL_TAKEN`; пароль короче 8 → 400.
Нового пользователя создаём без 2FA — при первом входе он получит QR.

### `GET /internal/auth/jwks` — для core-api, export-service, notifier

Без JWT (сеть внутренняя, nginx закрывает `/internal/`). Ответ:

```json
{ "keys": [ { "kty": "RSA", "use": "sig", "alg": "RS256", "kid": "q1w2e3r4t5y6u7i8", "n": "…", "e": "AQAB" } ] }
```

`n`, `e` — base64url без паддинга. Заголовок `Cache-Control: max-age=600`.

### `GET /health`

`200 {"status":"ok"}`, если `pool.Ping` прошёл; иначе 503.

## Безопасность — коротко

- Пароли и секреты никогда не логировать (ни в ошибках, ни в access-логах тел запросов).
- Ограничение попыток входа по паролю — достаточно 10 в минуту на email (в памяти, `map` + мьютекс).
- Время на сервере — UTC.

## Как проверить

```bash
curl -s localhost/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"demo@rt.ru","password":"Demo2026!"}'
# код: oathtool --totp -b JBSWY3DPEHPK3PXP
curl -s localhost/api/auth/2fa/verify -H 'content-type: application/json' \
  -d '{"mfaToken":"<из ответа>","code":"<6 цифр>"}'
curl -s localhost/api/companies -H "Authorization: Bearer <accessToken>"   # core-api принимает токен
```

## Продукт 2 — notifier (после зелёной сборки)

Папка `notifier/`, порт 8083, схема `notify`, пользователь `notify_svc` (таблицы уже созданы), профиль compose `product2`.

- `GET/POST /api/subscriptions`, `DELETE /api/subscriptions/{id}` — подписка на `industry` / `municipalityId` /
  `need` / `stage` (хотя бы одно поле, иначе 422); пользователь = `sub` из JWT.
- `GET /api/notifications?unread=true`, `POST /api/notifications/{id}/read`, `GET /api/notifications/telegram-link`
  (`https://t.me/<bot>?start=<link_token>`).
- Telegram-бот: `/start <link_token>` → записать `chat_id` в `notify.telegram_link`.
- Воркер раз в `CHECK_INTERVAL`: `GET http://core-api:8080/internal/projects?updatedSince=<notify.state.lastCheckedAt>`
  с `X-Internal-Token` → для каждого проекта найти подходящие подписки → `INSERT … ON CONFLICT (user_id, project_id) DO NOTHING`
  в `notify.notification` → отправить в Telegram, если чат привязан → обновить `lastCheckedAt`. В схему `core` не ходить.
- `POST /internal/notifier/check` — ручной запуск проверки на демо.

## Готово, когда

Вход работает с настоящим приложением-аутентификатором (Google или Яндекс), токен принимают core-api и
export-service, 5 неверных кодов блокируют сессию, после перезапуска контейнера старые токены валидны.

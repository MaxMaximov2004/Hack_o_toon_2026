# Тестовые ключи JWT — разработка без auth-service

Для Java (core-api), C# (export-service) и Go (notifier): проверять JWT можно, не дожидаясь auth-service.
**Только для разработки.** Настоящий auth-service создаёт свой ключ, и токены, подписанные этим ключом,
в полной сборке отклоняются (это проверяет `infra/smoke.sh`). Поэтому приватный ключ лежит в git открыто.

| Файл | Что это |
| --- | --- |
| `jwks.json` | JWKS (kid `dev-1`) — в том же формате, что отдаёт `GET /internal/auth/jwks` |
| `jwt-dev-public.pem` | публичный ключ, если удобнее PEM |
| `jwt-dev-private.pem` | приватный ключ — им подписывает `mint-token.sh` |
| `mint-token.sh` | выпускает accessToken как после входа с 2FA |
| `auth-stub.conf` | nginx-заглушка auth-service: `/health` + JWKS |
| `gen-keys.sh` | перегенерировать пару (не нужно, если файлы на месте) |

## Как пользоваться

**1. Поднять заглушку вместо auth-service** (в сети docker она откликается на имя `auth-service`, поэтому
`AUTH_JWKS_URL` из compose менять не нужно):

```bash
docker compose --profile auth-stub up -d --build postgres auth-stub core-api
curl http://localhost:18081/internal/auth/jwks      # с хоста — для запуска из IDE (порт 18081, не 8081)
```

Не поднимать вместе с настоящим `auth-service` — оба отвечают на одно имя.

Заглушка умеет и упрощённый вход — чтобы пройти фронт в браузере без Go: **любой** email и пароль, **любой**
6-значный код → токен демо-менеджера (настоящий JWT dev-ключа, сроком на год). Неверный пароль и код она не
проверяет — это работа настоящего auth-service. Посмотреть всё, что готово:

```bash
docker compose --profile auth-stub up -d --build postgres etl core-api nginx auth-stub
# http://localhost — любой логин/пароль, любой код из 6 цифр
```

**2. Получить токен** (Git Bash / macOS / Linux, нужен только `openssl`):

```bash
TOKEN=$(bash contracts/dev-keys/mint-token.sh)           # manager, 8 ч
TOKEN=$(bash contracts/dev-keys/mint-token.sh admin)     # manager + admin (импорт клиентов)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/companies
```

**3. Проверить, что плохие токены отклоняются** — все должны дать 401:

```bash
NO_OTP=1 bash contracts/dev-keys/mint-token.sh   # amr без "otp"
ISS=evil bash contracts/dev-keys/mint-token.sh   # чужой iss
TTL=-60  bash contracts/dev-keys/mint-token.sh   # истёк
```

Содержимое токена — как в контракте (`docs/tz/00-common.md`):

```json
{ "iss": "radar-auth", "sub": "1", "email": "demo@rt.ru", "name": "Демо Менеджер",
  "roles": ["manager"], "amr": ["pwd", "otp"], "iat": 1792780000, "exp": 1792808800, "jti": "…" }
```

## Без Docker

- **Java (Spring):** для локального профиля можно вместо `jwk-set-uri` указать
  `spring.security.oauth2.resourceserver.jwt.public-key-location=file:../contracts/dev-keys/jwt-dev-public.pem`.
  В основном конфиге — только `jwk-set-uri=${AUTH_JWKS_URL}`.
- **C# / Go:** ключ из `jwks.json` или `jwt-dev-public.pem`, но в коде сервиса — только загрузка по `AUTH_JWKS_URL`.

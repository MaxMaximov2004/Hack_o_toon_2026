# Интеграция calc-service в docker-compose

## Переменные окружения (добавить в .env)

```env
CALC_DB_PASSWORD=calc_dev
INTERNAL_TOKEN=internal_dev_token
```

## Блок docker-compose.yml (добавить в services)

```yaml
  calc-service:
    build: ./calc-service
    container_name: radar-calc-service
    profiles: ["calc"]
    environment:
      DATABASE_URL: postgres://calc_svc:${CALC_DB_PASSWORD:-calc_dev}@postgres:5432/radar?sslmode=disable
      CORE_API_URL: http://core-api:8080
      AUTH_JWKS_URL: http://auth-service:8081/internal/auth/jwks
      INTERNAL_TOKEN: ${INTERNAL_TOKEN:-internal_dev_token}
    ports:
      - "8085:8085"
    depends_on:
      postgres:
        condition: service_healthy
      auth-service:
        condition: service_healthy
      core-api:
        condition: service_healthy
    networks:
      - radar
```

## Nginx (добавить в infra/nginx/nginx.conf)

```nginx
# В upstream-секцию (если есть) или в server-блок:
# set $calc http://calc-service:8085;

# В server-блок:
location /api/calc/ {
    set $calc http://calc-service:8085;
    proxy_pass $calc;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /healthz/calc {
    set $calc http://calc-service:8085;
    proxy_pass $calc/health;
}
```

## Строки для infra/smoke.sh (добавить в сервисы)

```bash
# В список svcs добавить calc:
svcs="auth core export calc"

# Или отдельной строкой:
check "/healthz/calc" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/healthz/calc")" "200"
```

## Как запустить

```bash
# С профилем calc:
docker compose --profile calc up -d

# Проверить:
curl http://localhost:8085/health
# или через nginx:
curl http://localhost/healthz/calc
```

## Примечания

- calc-service использует профиль `calc` — не запускается по умолчанию.
- Роль `calc_svc` имеет доступ только к схеме `calc` (SELECT).
- Сеть: только core-api и auth-service (JWKS).
- Порт 8085 (8080–8084 заняты другими сервисами).

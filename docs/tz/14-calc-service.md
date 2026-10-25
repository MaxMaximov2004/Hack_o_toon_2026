# Калькулятор сделок — реализация

Сервис `calc-service` на FastAPI (порт 8085).

## Что реализовано

- GET /health — без токена, возвращает {"status":"ok"}.
- GET /api/calc/catalog — справочники из БД (регионы, уровни, этапы, компоненты), параметры расширений.
- POST /api/calc/estimate — полный расчёт по формулам ТЗ (items, costs, price, margin, breakdown, analogs, assumptions).
- POST /api/calc/proposal — КП в DOCX (python-docx, фирменные цвета, RFC 5987, дата по Москве).
- POST /api/calc/export/csv — таблица позиций (UTF-8 BOM, разделитель `;`, ru-RU числа, dd.MM.yyyy).
- POST /internal/calc/estimate — внутренний эндпоинт (X-Internal-Token, сравнение за постоянное время).
- JWT: RS256, JWKS по kid (кэш 10 мин, перезапрос для неизвестного kid), exp (допуск 60 с), iss, amr с otp.
- Валидация: неизвестные ID, дубликаты, qty ≤ 0 или > 100000, > 200 позиций → 400 VALIDATION_ERROR.
- Единый формат ошибок, включая переопределение 422 → 400.
- Аналоги: GET /internal/projects (core-api, таймаут 5 с, кэш 10 мин), ИТ-бюджет = amountMln × 1e6 × itShare[industry].
- Формулы: Decimal везде, ROUND_HALF_UP до копеек, водопад в сумме = optimal.
- Расширения: uniqueMarkup, nonStandardMarkup, financing rate[], volumeDiscount, maxFactor, minMargin — в pricing_params.json.

## Запуск

```bash
docker build -t calc-service ./calc-service
docker run -p 8085:8085 \
  -e DATABASE_URL="postgres://calc_svc:calc_dev@postgres:5432/radar?sslmode=disable" \
  -e CORE_API_URL="http://core-api:8080" \
  -e AUTH_JWKS_URL="http://auth-service:8081/internal/auth/jwks" \
  -e INTERNAL_TOKEN="internal_dev_token" \
  calc-service
```

## Переменные

| Переменная | Описание |
|------------|----------|
| DATABASE_URL | Подключение к БД (роль calc_svc) |
| CORE_API_URL | Адрес core-api для аналогов |
| AUTH_JWKS_URL | Адрес JWKS для JWT |
| INTERNAL_TOKEN | Внутренний токен |

## Формулы

```
equipment = Σ qty × base_price × complexity
works = equipment × Σ share_of_equipment
direct = equipment + works
P1 = direct × region.coef
P2 = P1 × level.coef
P3 = P2 × (urgent ? 1.2 : 1)
P4 = P3 × (1 + uniqueMarkup) если uniqueSolution
P5 = P4 × (1 + rate × termMonths / 12)
P6 = P5 × (1 − volumeDiscount)
optimal = P6
max = optimal × maxFactor
margin = (цена − direct) / цена × 100
```

## Тесты

```bash
pytest calc-service/tests/ -v
```

## Что не проверено

- Интеграция с реальным core-api (нет запущенного core-api при тестировании).
- Скачивание DOCX из браузера (проверено через TestClient).
- Нагрузка (пул соединений не стресс-тестировался).

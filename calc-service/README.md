# Калькулятор сделок

Сервис расчёта коммерческих предложений для инвестпроектов.

## Запуск

### Локально (без Docker)
```bash
cd calc-service
pip install -r requirements.txt
export DATABASE_URL="postgres://calc_svc:password@localhost:5432/radar?sslmode=disable"
export CORE_API_URL="http://localhost:8080"
export AUTH_JWKS_URL="http://localhost:8081/internal/auth/jwks"
export INTERNAL_TOKEN="internal_dev_token"
uvicorn app.main:app --port 8085
```

### Docker
```bash
docker build -t calc-service ./calc-service
docker run -p 8085:8085 \
  -e DATABASE_URL="postgres://calc_svc:password@postgres:5432/radar?sslmode=disable" \
  -e CORE_API_URL="http://core-api:8080" \
  -e AUTH_JWKS_URL="http://auth-service:8081/internal/auth/jwks" \
  -e INTERNAL_TOKEN="internal_dev_token" \
  calc-service
```

### Docker Compose (см. INTEGRATION.md)
Поднимает calc-service вместе с postgres и auth-stub.

## API

### GET /health
```bash
curl http://localhost:8085/health
# {"status":"ok"}
```

### GET /api/calc/catalog
```bash
curl http://localhost:8085/api/calc/catalog
```

### POST /api/calc/estimate
```bash
curl -X POST http://localhost:8085/api/calc/estimate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "regionId": 1,
    "level": "basic",
    "stages": ["pir", "pnr"],
    "items": [{"componentId": "el_01", "qty": 10}]
  }'
```

### POST /api/calc/proposal (DOCX)
```bash
curl -X POST http://localhost:8085/api/calc/proposal \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "regionId": 1,
    "level": "basic",
    "stages": ["pir"],
    "items": [{"componentId": "el_01", "qty": 10}],
    "client": {"name": "ООО Тест", "inn": "1234567890"}
  }' -o proposal.docx
```

### POST /api/calc/export/csv
```bash
curl -X POST http://localhost:8085/api/calc/export/csv \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "regionId": 1,
    "level": "basic",
    "stages": ["pir"],
    "items": [{"componentId": "el_01", "qty": 10}]
  }' -o estimate.csv
```

## Формулы

### Базовые
- `equipment = Σ qty × base_price × complexity` (+ customItems)
- `works = equipment × Σ share_of_equipment`
- `direct = equipment + works`

### Цепочка P1..P6
- `P1 = direct × region.coef`
- `P2 = P1 × level.coef`
- `P3 = P2 × (urgent ? 1.2 : 1)`
- `P4 = P3 × (1 + uniqueMarkup) если uniqueSolution`
- `P5 = P4 × (1 + rate[financing] × termMonths/12)`
- `P6 = P5 × (1 − volumeDiscount(direct))`
- `optimal = P6`

### Маржа
- `margin = (цена − direct) / цена × 100`
- `max = optimal × maxFactor`

### Минимум
- Если аналогов ≥ 5: `min = clamp(P25 бюджетов аналогов, direct × (1+minMargin), optimal × 0.95)`
- Иначе: `min = optimal × 0.9`

### Водопад
Каждый шаг = разность между соседними P. Сумма шагов + direct = optimal.

## Допущения

| Параметр | Значение | Обоснование |
|----------|----------|-------------|
| uniqueMarkup | 15% | Наценка за уникальное решение |
| nonStandardMarkup | 20% | Наценка за нестандартные позиции |
| maxFactor | 1.15 | Максимальная цена = optimal × 1.15 |
| minMargin | 10% | Минимальная маржа для clamp |
| financing_rates | 0.5-13% | Консервативная оценка ставки |
| volume_discounts | 0-5% | Ступени: 1М, 5М, 10М, 50М, 100М |
| itShare | 7-15% | Доля ИТ в инвестпроектах, отрасль-зависимо |
| аналоги | путь B | core-api /internal/projects, ИТ-бюджет = amountMln × 1e6 × itShare |
| ретроданные | нет | В case.xlsx нет ретроданных прошлых сделок |

### Важно
- ИТ-бюджет рассчитан по **инвестиционным проектам** клиентов, а не по ценам сделок Ростелекома.
- Все значения расширений (наценки, ставки, дисконты) — допущения, согласуются с куратором.
- Цены с сайтов НЕ парсятся, всё из БД (схема calc).

## Тесты
```bash
pytest calc-service/tests/ -v
# Интеграционные тесты (требуют postgres):
CALC_INTEGRATION=1 pytest calc-service/tests/ -v
```

## Структура
```
calc-service/
├── Dockerfile
├── requirements.txt
├── README.md
├── INTEGRATION.md
├── app/
│   ├── main.py          # FastAPI, маршруты, middleware
│   ├── config.py         # ENV-конфиг
│   ├── errors.py         # Обработка ошибок
│   ├── auth.py           # JWT (RS256, JWKS)
│   ├── db.py             # psycopg 3 пул
│   ├── catalog.py        # Справочники с кэшем 60с
│   ├── engine.py         # Ядро расчёта
│   ├── analogs.py        # Аналоги (core-api)
│   ├── estimate.py       # Pydantic-модели
│   ├── export_csv.py     # CSV экспорт
│   └── export_docx.py    # DOCX КП
├── data/
│   └── pricing_params.json
└── tests/
```

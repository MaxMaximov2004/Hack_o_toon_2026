Жёсткие границы
Все новые файлы — только в папке calc-service/. Дополнительно разрешено ДОБАВЛЯТЬ (не менять существующие) новые файлы:
docs/tz/14-calc-service.md и contracts/examples/calc-*.json.
НЕ редактируй существующие файлы: docker-compose.yml, infra/*, README.md, .env.example, схемы БД, чужие сервисы.
Всё, что нужно в общих файлах, оформи готовыми фрагментами в calc-service/INTEGRATION.md (compose-блок, location для nginx,
строки для smoke.sh, при необходимости SQL для техлида). Это зона техлида, он вносит через PR.
Работай в ветке feature/calc-service, коммить небольшими осмысленными коммитами. Не пушь и не мержь.
Правила проекта: свой сервис, свой пользователь БД (calc_svc), к соседям только по HTTP, таблицы из кода не создавать,
Dockerfile + GET /health + конфиг только из переменных окружения. Без значений по умолчанию с тестовым токеном или localhost
в коде (замечание техлида к другому сервису): все значения приходят из env, при отсутствии обязательных переменных — понятная
ошибка при старте.
Цены с сайтов НЕ парсим. Все цены и коэффициенты — из БД (схема calc). Сеть в рантайме — только core-api и auth-service (JWKS).
Шаг 0. Разведка (обязательно до кода)
Прочитай и кратко запиши выводы в calc-service/README.md (раздел «Допущения»):
infra/db/init/01_roles_and_schemas.sh, 02_tables.sql (раздел calc), 03_seed.sql (вставки calc), 04_need_offer.sql —
какие таблицы есть: calc.region_coef(id,name,coef,reason), calc.project_level(code,name,coef,description),
calc.work_stage(code,name,share_of_equipment,comment), calc.component(id,system_group,name,unit,base_price,complexity).
Роль calc_svc видит только схему calc (search_path=calc), к core доступа нет.
infra/db/tools/case.xlsx: перечисли ВСЕ листы и заголовки. Есть ли ретроданные прошлых сделок (цены, параметры проектов)?
Если да — используй их как аналоги (положи в calc-service/data/analogs.csv и опиши происхождение). Если нет — путь B ниже.
Образцы и соглашения: README.md (правила сервисов), docs/tz/00-common.md (формат ошибок, JSON camelCase, пагинация),
docs/tz/06-csharp-export.md и 09-csharp-export-todo.md (формат CSV/КП у C#-разработчика — не расходись с ним и не дублируй
чужой эндпоинт; проверь export-service/Controllers/ExportController.cs, нет ли там уже /api/export/proposal),
docs/tz/08-product2-contract.md, contracts/examples/projects-internal.json и
core-api/src/main/java/ru/rt/radar/invest/InternalProjectController.java (формат GET /internal/projects),
docs/tz/13-testing.md (принятое тестирование), core-api/CLAUDE.md (стиль работы команды),
frontend/src/styles/tokens.css (фирменные цвета для шапки КП),
contracts/dev-keys/README.md, mint-token.sh, jwks.json (как проверять без auth-service),
docker-compose.yml, infra/nginx/nginx.conf, infra/smoke.sh (какие порты заняты, как подключаются сервисы).
Выбери свободный порт (предположительно 8085; 8080–8084 заняты).
Стек и структура
FastAPI + uvicorn, pydantic v2, psycopg 3 (пул), PyJWT[crypto], httpx, python-docx, pytest. Зафиксируй версии в requirements.txt.
calc-service/
Dockerfile (python:3.12-slim, не root, HEALTHCHECK), requirements.txt, README.md, INTEGRATION.md
app/{main.py, config.py, errors.py, auth.py, db.py, catalog.py, engine.py, analogs.py, estimate.py, export_csv.py, export_docx.py}
data/pricing_params.json  (расширения расчёта, см. ниже; у каждого параметра поле "assumption": true/false и комментарий)
tests/
API (JSON camelCase, деньги в рублях числом, даты ISO)
Публичные (Authorization: Bearer):
GET  /api/calc/catalog  → регионы, уровни, этапы, компоненты (сгруппированы по systemGroup), параметры расширений, список допущений.
POST /api/calc/estimate → тело:
{ regionId, level, termMonths, financing: "prepay|installment|leasing",
items:[{componentId, qty, nonStandard?:bool}], customItems?:[{name,unit,unitPrice,qty,complexity?}],
stages:["pir","pnr","shef"], urgent?:bool, uniqueSolution?:bool }
ответ: { items(строки с суммами), costs{equipment,works,direct}, price{min,optimal,max,minBasis,urgent},
margin{minPct,optimalPct,maxPct,curve:[{price,marginPct}]},   // кривая из ~20 точек от min×0.95 до max×1.05
breakdown:[{key,label,amount}],                               // «водопад»: шаги в сумме дают optimal
analogs{available,source,count,percentile,distribution{p10,p25,p50,p75,p90},nearest:[...5 ближайших]},
assumptions:[строки] }
POST /api/calc/proposal → КП в DOCX (тело = тело estimate + client{name,inn?,contact?}); файл radar_proposal_YYYY-MM-DD.docx,
Content-Disposition по RFC 5987 (filename и filename*=UTF-8''), дата по Москве.
POST /api/calc/export/csv → таблица позиций; соглашения CSV (кодировка, разделитель, числа без разделителя тысяч, десятичная запятая)
возьми из docs/tz/06-csharp-export.md.
Внутренний (X-Internal-Token, сравнение за постоянное время): POST /internal/calc/estimate (то же, что estimate, для других сервисов).
Без токена: GET /health → 200 {"status":"ok"}.
Валидация: неизвестные regionId/componentId/level/stage, дубликаты позиций, qty ≤ 0 или > 100000, больше 200 позиций → 400 VALIDATION_ERROR
с details {"field":"items[2].componentId"}.
Формулы (Decimal везде, округление ROUND_HALF_UP до копеек в конце)
equipment = Σ qty × base_price × complexity  (+ customItems: qty × unitPrice × complexity, по умолчанию 1.0)
works     = equipment × Σ share_of_equipment выбранных этапов
direct    = equipment + works     (себестоимость, база для маржи)
Последовательно: P1 = direct × region.coef; P2 = P1 × level.coef; P3 = P2 × (urgent ? 1.2 : 1);
P4 = P3 × (1 + uniqueMarkup если uniqueSolution); P5 = P4 × (1 + rate[financing] × termMonths/12);
P6 = P5 × (1 − volumeDiscount(direct)); optimal = P6. Шаги водопада — разности P_i − P_{i−1}; их сумма вместе с direct равна optimal.
Нестандартная позиция (nonStandard или customItem): к её стоимости добавляется наценка nonStandardMarkup, показывается отдельной строкой.
Параметры расширений (uniqueMarkup, nonStandardMarkup, rate[], volume-ступени, maxFactor, minMargin) — в data/pricing_params.json.
По умолчанию расширения выключены/нулевые: при urgent=false, uniqueSolution=false, financing=prepay и без нестандарта результат
ОБЯЗАН совпадать с формулой ТЗ optimal = (equipment+works) × region.coef × level.coef × (urgent ? 1.2 : 1) — сделай это тестом.
Маржа = (цена − direct) / цена × 100. max = optimal × maxFactor (по умолчанию 1.15, допущение).
Минимум: если аналогов ≥ 5 — min = clamp(P25 бюджетов аналогов, direct × (1+minMargin), optimal × 0.95), minBasis="analogs_p25";
иначе min = optimal × 0.9, minBasis="fallback_0.9" и явная пометка в assumptions (по ТЗ правило минимума согласуется с куратором).
Аналоги
Единый интерфейс провайдера. Путь A — реальные ретроданные, если нашлись в case.xlsx. Путь B (по умолчанию):
GET {CORE_API_URL}/internal/projects с X-Internal-Token (таймаут 5 с), поля сумм и отраслей — по реальному контракту, который ты прочитал.
ИТ-бюджет аналога = amountMln × 1 000 000 × itShare[отрасль] (таблица доли в data/pricing_params.json, assumption=true, значения
консервативные; в README честно написать, что это инвестпроекты клиентов, а не цены сделок Ростелекома). Кэш на 10 минут.
Ближайшие аналоги — по близости масштаба (лог-расстояние между optimal и ИТ-бюджетом), при необходимости фильтр по отрасли.
Недоступность core-api не должна ронять расчёт: analogs.available=false, минимум по запасному правилу.
JWT (одинаково во всех сервисах проекта)
Токен из Authorization: Bearer; только RS256 (none/HS256 отклонять ещё по заголовку); ключ из JWKS по AUTH_JWKS_URL по kid;
JWKS запрашивать лениво при первом запросе с токеном, кэш 10 минут, неизвестный kid — один повторный запрос;
проверки: подпись, exp (допуск 60 с), iss == "radar-auth", в claim amr (массив) есть "otp"; aud не проверять.
Ответы: нет заголовка → 401 UNAUTHORIZED «Требуется вход: передайте заголовок Authorization: Bearer <accessToken>»;
плохой/истёкший/без otp/чужой iss → 401 UNAUTHORIZED «Токен недействителен или истёк — войдите заново»;
auth-service не ответил за 5 с → 502 UPSTREAM_UNAVAILABLE «Сервис авторизации недоступен — повторите позже».
К 401 — заголовок WWW-Authenticate: Bearer. Причину отказа клиенту не раскрывать, только в лог. Роли не требуются.
Ошибки
Везде формат { "error": { "code", "message", "details" } }; details — null или объект. Коды: VALIDATION_ERROR 400, UNAUTHORIZED 401,
NOT_FOUND 404, UPSTREAM_UNAVAILABLE 502, INTERNAL_ERROR 500 (стектрейс только в лог). Переопредели обработчики FastAPI/pydantic,
чтобы стандартные ответы 422 тоже приходили в этом формате (как 400 VALIDATION_ERROR).
БД
Подключение DATABASE_URL (роль calc_svc), только SELECT, никаких DDL. Каталог кэшируй на 60 с. Если справочники пусты или БД недоступна —
502 UPSTREAM_UNAVAILABLE с понятным сообщением, не 500.
КП (DOCX)
python-docx. Шапка с названием «Ростелеком» в фирменном цвете из tokens.css (логотип — только если файл найден в репозитории),
«Коммерческое предложение №…», дата, блок клиента, таблица позиций (№, наименование, ед., кол-во, цена за ед., сумма), этапы работ и их стоимость,
условия расчёта (регион, уровень, срочность, финансирование, срок), итог «минимум / оптимум», пометка «Расчёт предварительный» и список допущений.
Тесты и проверка
pytest: формулы на заранее посчитанных числах (в том числе совпадение с формулой ТЗ); свойство «шаги водопада в сумме дают optimal»;
JWT-тесты со сгенерированной парой RSA и поддельным JWKS (нет заголовка, плохая подпись, HS256, истёкший, чужой iss, без otp, неизвестный kid,
недоступный JWKS → 502); API через TestClient с подменой репозитория каталога; DOCX открывается и содержит итоговые суммы;
CSV-соглашения. Интеграционный тест против postgres из compose — только если задана переменная окружения, иначе skip.
Проверь реально: docker build ./calc-service; запусти контейнер с env и проверь curl'ом /health, 401 без токена, 200 с токеном из
contracts/dev-keys/mint-token.sh (если можно поднять auth-stub профиль compose), estimate и скачивание КП. Если что-то не удалось проверить
(например, нет Docker) — прямо напиши, что именно не проверено.
Что сдать
Код, тесты, Dockerfile, README (запуск, формулы, допущения, примеры curl), INTEGRATION.md (фрагменты для compose [с profiles: ["calc"]],
nginx location /api/calc/ → calc-service, строки для smoke.sh, переменные окружения), docs/tz/14-calc-service.md,
contracts/examples/calc-estimate.json (пример ответа). В конце — краткий отчёт: что сделано, что проверено, список допущений,
вопросы к куратору (правило минимума, доли ИТ-бюджета, наценки) и чего не хватило.
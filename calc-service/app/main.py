"""FastAPI приложение — калькулятор сделок."""

import os
import httpx
import jwt
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, Request, HTTPException, Header
from fastapi.responses import Response, StreamingResponse

from app.config import settings
from app.db import init_pool
from app.errors import register_exception_handlers
from app.auth import verify_jwt
from app.catalog import get_catalog, invalidate as invalidate_catalog, validate_region, validate_level, validate_stages, validate_components
from app.estimate import EstimateRequest, handle_estimate
from app.export_csv import generate_bitrix_lead, generate_csv_estimate
from app.export_docx import generate_proposal
from app.engine import load_pricing_params


_MOSCOW = timezone(timedelta(hours=3))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Инициализация пула БД при старте, закрытие при остановке."""
    init_pool()
    yield


app = FastAPI(title="Калькулятор сделок", version="1.0.0", lifespan=lifespan)
register_exception_handlers(app)

# Глобальный валидатор каталога (для estimate)
class _CatalogValidator:
    @staticmethod
    def validate_region(rid):
        try:
            return validate_region(rid)
        except Exception:
            return False

    @staticmethod
    def validate_level(code):
        try:
            return validate_level(code)
        except Exception:
            return False

    @staticmethod
    def validate_stages(codes):
        try:
            return validate_stages(codes)
        except Exception:
            return False

    @staticmethod
    def validate_components(ids):
        try:
            return validate_components(ids)
        except Exception:
            return False

_validator = _CatalogValidator()


def _check_auth(authorization: str | None = None) -> dict:
    """Проверяет Bearer-токен. Возвращает decoded payload."""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Требуется вход: передайте заголовок Authorization: Bearer <accessToken>",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0] != "Bearer":
        raise HTTPException(
            status_code=401,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Токен недействителен или истёк — войдите заново",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1]

    try:
        payload = verify_jwt(token)
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Токен недействителен или истёк — войдите заново",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.DecodeError, jwt.InvalidTokenError):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Токен недействителен или истёк — войдите заново",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=502,
            detail={
                "code": "UPSTREAM_UNAVAILABLE",
                "message": "Сервис авторизации недоступен — повторите позже",
            },
        )


def _check_internal(x_internal_token: str | None = None) -> None:
    """Проверяет внутренний токен (постоянное время)."""
    if not x_internal_token:
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Требуется внутренний токен"},
        )
    import hmac
    if not hmac.compare_digest(x_internal_token, settings.INTERNAL_TOKEN):
        raise HTTPException(
            status_code=401,
            detail={"code": "UNAUTHORIZED", "message": "Неверный внутренний токен"},
        )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/calc/catalog")
async def catalog():
    data = get_catalog()
    params = load_pricing_params()
    data["pricingParams"] = {
        "uniqueMarkup": params["unique_markup"],
        "nonStandardMarkup": params["non_standard_markup"],
        "financingRates": params["financing_rates"],
        "volumeDiscounts": params["volume_discounts"],
        "maxFactor": params["max_factor"],
        "minMargin": params["min_margin"],
        "itShare": params["it_share"],
    }
    data["assumptions"] = params.get("assumptions", [])
    return data


@app.post("/api/calc/estimate")
async def estimate(req: EstimateRequest, request: Request):
    auth = request.headers.get("authorization")
    _check_auth(auth)

    try:
        result = handle_estimate(req, _validator)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": {"field": "items"},
            },
        )


@app.post("/api/calc/proposal")
async def proposal(req: EstimateRequest, request: Request):
    auth = request.headers.get("authorization")
    _check_auth(auth)

    client = req.client.model_dump() if req.client else None

    try:
        result = handle_estimate(req, _validator)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": {"field": "items"},
            },
        )

    docx_bytes = generate_proposal(result, client)

    now_msk = datetime.now(_MOSCOW)
    date_str = now_msk.strftime("%Y-%m-%d")
    filename = f"radar_proposal_{date_str}.docx"

    return StreamingResponse(
        iter([docx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; '
                f"filename*=UTF-8''{filename}"
            ),
        },
    )


@app.post("/api/calc/export/csv")
async def export_csv(req: EstimateRequest, request: Request):
    auth = request.headers.get("authorization")
    _check_auth(auth)

    try:
        result = handle_estimate(req, _validator)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": {"field": "items"},
            },
        )

    csv_bytes = generate_csv_estimate(result)
    now_msk = datetime.now(_MOSCOW)
    date_str = now_msk.strftime("%Y-%m-%d")
    filename = f"estimate_{date_str}.csv"

    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; '
                f"filename*=UTF-8''{filename}"
            ),
        },
    )


@app.post("/api/calc/export/bitrix")
async def export_bitrix(req: EstimateRequest, request: Request):
    """Расчёт на экране -> лид Bitrix24 с суммой сделки (кейс: экспорт в CSV/CRM из любого модуля)."""
    auth = request.headers.get("authorization")
    _check_auth(auth)

    if req.client is None:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "Для лида в CRM укажите клиента: client.name",
                "details": {"field": "client.name"},
            },
        )
    try:
        result = handle_estimate(req, _validator)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": {"field": "items"},
            },
        )

    filename = f"estimate_bitrix_{datetime.now(_MOSCOW).strftime('%Y-%m-%d')}.csv"
    return Response(
        content=generate_bitrix_lead(result, req.client.model_dump()),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; '
                f"filename*=UTF-8''{filename}"
            ),
        },
    )


def _etl(method: str, path: str) -> httpx.Response:
    """Парсинг цен живёт в ETL (etl/etl/prices.py) — проксируем с внутренним токеном."""
    if not settings.ETL_URL:
        raise HTTPException(status_code=502, detail={
            "code": "UPSTREAM_UNAVAILABLE", "message": "Сервис загрузки данных не настроен (ETL_URL)"})
    try:
        with httpx.Client(timeout=5.0) as client:
            return client.request(method, settings.ETL_URL + path,
                                  headers={"X-Internal-Token": settings.INTERNAL_TOKEN})
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail={
            "code": "UPSTREAM_UNAVAILABLE", "message": "Сервис загрузки данных недоступен — повторите позже"})


@app.post("/api/calc/prices/refresh", status_code=202)
async def prices_refresh(request: Request):
    """Запустить парсинг цен (прайсы Ростелекома + аналоги tinko.ru). Только админ, как импорт клиентов."""
    payload = _check_auth(request.headers.get("authorization"))
    if "admin" not in (payload.get("roles") or []):
        raise HTTPException(status_code=403, detail={
            "code": "FORBIDDEN", "message": "Обновлять цены может только администратор"})
    resp = _etl("POST", "/internal/etl/prices")
    if resp.status_code == 409:
        raise HTTPException(status_code=409, detail={"code": "CONFLICT", "message": "Цены уже обновляются"})
    if resp.status_code != 202:
        raise HTTPException(status_code=502, detail={
            "code": "UPSTREAM_UNAVAILABLE", "message": "Сервис загрузки данных не принял запрос"})
    return {"status": "started"}


@app.get("/api/calc/prices/status")
async def prices_status(request: Request):
    """{running, last: {status, startedAt, finishedAt, details}} — когда и откуда последний раз взяты цены."""
    _check_auth(request.headers.get("authorization"))
    resp = _etl("GET", "/internal/etl/prices/status")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail={
            "code": "UPSTREAM_UNAVAILABLE", "message": "Сервис загрузки данных не ответил"})
    body = resp.json()
    if not body.get("running"):
        invalidate_catalog()          # парсинг закончился — следующий /catalog отдаст новые цены
    return body


@app.post("/internal/calc/estimate")
async def internal_estimate(req: EstimateRequest, x_internal_token: str = Header(default=None)):
    """Внутренний эндпоинт для других сервисов (без JWT, с X-Internal-Token)."""
    _check_internal(x_internal_token)

    try:
        result = handle_estimate(req, _validator)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "VALIDATION_ERROR",
                "message": str(e),
                "details": {"field": "items"},
            },
        )

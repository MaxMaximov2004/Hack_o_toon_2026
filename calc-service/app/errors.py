"""Единый формат ошибок для всех эндпоинтов."""

from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError


def _detail_to_obj(err: dict) -> dict:
    loc = err.get("loc", ())
    parts = [p for p in loc if p not in ("body",)]
    if parts:
        return {"field": ".".join(str(p) for p in parts)}
    return {}


async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Конвертирует HTTPException в формат {"error": {...}}."""
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": detail},
            headers=exc.headers,
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "INTERNAL_ERROR", "message": str(detail), "details": None}},
        headers=exc.headers,
    )


async def _validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, RequestValidationError):
        errors = exc.errors()
        details = {}
        for e in errors:
            d = _detail_to_obj(e)
            if d:
                details["field"] = d.get("field", "unknown")
                break
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Ошибка валидации", "details": details or None}},
        )
    if isinstance(exc, ValidationError):
        e0 = exc.errors()[0]
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Ошибка валидации", "details": _detail_to_obj(e0)}},
        )
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "Внутренняя ошибка сервера", "details": None}},
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(HTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(ValidationError, _validation_error_handler)
    app.add_exception_handler(Exception, _validation_error_handler)

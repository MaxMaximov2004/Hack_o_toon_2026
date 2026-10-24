"""Конфигурация тестов."""

import os
import json
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


@pytest.fixture(autouse=True)
def _mock_catalog_cache():
    """Подменяет кэш каталога для тестов (без БД)."""
    mock_data = {
        "regions": {
            "data": {"regions": [
                {"id": 1, "name": "Центральный", "coef": 1.0, "reason": ""},
                {"id": 2, "name": "Южный", "coef": 1.1, "reason": ""},
            ]},
            "ts": 9999999999,
        },
        "levels": {
            "data": {"levels": [
                {"code": "basic", "name": "Базовый", "coef": 1.0, "description": ""},
                {"code": "advanced", "name": "Продвинутый", "coef": 1.3, "description": ""},
                {"code": "expert", "name": "Экспертный", "coef": 1.6, "description": ""},
            ]},
            "ts": 9999999999,
        },
        "stages": {
            "data": {"stages": [
                {"code": "pir", "name": "Проектирование", "share_of_equipment": 0.10},
                {"code": "pnr", "name": "ПНР", "share_of_equipment": 0.15},
                {"code": "shef", "name": "Шефмонтаж", "share_of_equipment": 0.05},
            ]},
            "ts": 9999999999,
        },
        "components": {
            "data": {"components": {
                "sensors": [
                    {"id": "el_01", "name": "Смарт-счетчик", "unit": "шт.", "base_price": 8500.0, "complexity": 1.2},
                    {"id": "el_02", "name": "Датчик температуры", "unit": "шт.", "base_price": 3200.0, "complexity": 1.0},
                ],
                "cables": [
                    {"id": "ht_01", "name": "Кабель витая пара", "unit": "м", "base_price": 45.0, "complexity": 1.0},
                ],
            }},
            "ts": 9999999999,
        },
    }
    from app import catalog
    catalog._CACHE.update(mock_data)


@pytest.fixture(autouse=True)
def _clear_catalog_cache():
    """Очищает кэш каталога между тестами."""
    from app import catalog
    # Не очищаем полностью — только старые записи
    yield


@pytest.fixture(autouse=True)
def _clear_jwks_cache():
    """Очищает кэш JWKS между тестами."""
    from app import auth
    auth._jwks = None
    auth._jwks_ts = 0
    auth._last_unknown_kid = ""
    auth._last_unknown_kid_ts = 0


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


@pytest.fixture
def mock_analogs():
    """Мокает модуль analogs."""
    with patch("app.engine.get_analogs_data") as mock:
        mock.return_value = {
            "available": True,
            "source": "test",
            "count": 10,
            "percentile": "p25",
            "distribution": {"p10": 50000, "p25": 80000, "p50": 120000, "p75": 180000, "p90": 250000},
            "nearest": [],
        }
        yield mock


@pytest.fixture
def mock_analogs_none():
    """Мокает analogs как недоступные."""
    with patch("app.engine.get_analogs_data") as mock:
        mock.return_value = {
            "available": False,
            "source": None,
            "count": 0,
            "percentile": None,
            "distribution": {},
            "nearest": [],
        }
        yield mock


def _needs_postgres():
    """Проверяет, нужно ли пропускать интеграционные тесты."""
    return os.environ.get("CALC_INTEGRATION") != "1"


integration = pytest.mark.skipif(
    _needs_postgres(),
    reason="set CALC_INTEGRATION=1 to run integration tests",
)

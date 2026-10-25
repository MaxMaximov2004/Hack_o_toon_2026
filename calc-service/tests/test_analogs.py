"""Подбор аналогов (app/analogs.py) — без мока get_analogs_data: core-api подменён, кэш настоящий."""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app import analogs

# ИТ-бюджет = amountMln × 1e6 × itShare[отрасль]; отрасль «other» — запасная доля 0.10, если её нет в таблице
PROJECTS = [{"id": i, "title": f"P{i}", "amountMln": mln, "industry": "zz_test"}
            for i, mln in enumerate([1, 10, 100, 1000, 10000, 100000], 1)]


@pytest.fixture(autouse=True)
def fresh_cache():
    analogs._projects, analogs._projects_ts = None, 0
    yield
    analogs._projects, analogs._projects_ts = None, 0


def _core(projects):
    resp = MagicMock(status_code=200)
    resp.json.return_value = projects
    client = MagicMock()
    client.__enter__.return_value.get.return_value = resp
    return client


def test_nearest_depends_on_price_and_core_called_once():
    with patch("app.analogs.httpx.Client", return_value=_core(PROJECTS)) as http:
        small = analogs.get_analogs_data(Decimal("100000"))          # ближе всего бюджет 0,1 млн (P1)
        big = analogs.get_analogs_data(Decimal("1000000000"))        # ближе всего бюджет 1 млрд (P5)
    assert small["nearest"][0]["id"] == 1
    assert big["nearest"][0]["id"] == 5
    assert [a["id"] for a in small["nearest"]] != [a["id"] for a in big["nearest"]]
    assert http.call_count == 1                                       # проекты из кэша, а не новый запрос
    assert small["distribution"] == big["distribution"]               # распределение — общее для всех сделок


def test_core_unavailable_fallback():
    client = MagicMock()
    client.__enter__.return_value.get.side_effect = analogs.httpx.ConnectError("down")
    with patch("app.analogs.httpx.Client", return_value=client):
        res = analogs.get_analogs_data(Decimal("100000"))
    assert res["available"] is False and res["nearest"] == []

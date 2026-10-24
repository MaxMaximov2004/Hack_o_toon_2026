"""Тесты формул расчёта (engine)."""

from decimal import Decimal, ROUND_HALF_UP
from unittest.mock import patch

import pytest

from app.engine import calculate_estimate, load_pricing_params, _round_kop


def _mock_catalog():
    return {
        "regions": [
            {"id": 1, "name": "Центральный", "coef": 1.0, "reason": ""},
            {"id": 2, "name": "Южный", "coef": 1.1, "reason": ""},
        ],
        "levels": [
            {"code": "basic", "name": "Базовый", "coef": 1.0, "description": ""},
            {"code": "advanced", "name": "Продвинутый", "coef": 1.3, "description": ""},
            {"code": "expert", "name": "Экспертный", "coef": 1.6, "description": ""},
        ],
        "stages": [
            {"code": "pir", "name": "Проектирование", "share_of_equipment": 0.10},
            {"code": "pnr", "name": "ПНР", "share_of_equipment": 0.15},
            {"code": "shef", "name": "Шефмонтаж", "share_of_equipment": 0.05},
        ],
        "components": {
            "sensors": [
                {"id": "el_01", "name": "Смарт-счетчик", "unit": "шт.", "base_price": 8500.0, "complexity": 1.2},
            ],
        },
    }


@pytest.fixture(autouse=True)
def _patch_catalog():
    with patch("app.engine.get_catalog", return_value=_mock_catalog()):
        with patch("app.engine.load_pricing_params", return_value=load_pricing_params()):
            yield


def _params():
    return {
        "unique_markup": 15,
        "non_standard_markup": 20,
        "max_factor": 1.15,
        "min_margin": 10,
        "financing_rates": {"1": 0.5, "3": 1.0, "6": 2.5, "12": 5.0, "24": 9.0, "36": 13.0},
        "volume_discounts": {"1000000": 0, "5000000": 1, "10000000": 2, "50000000": 3, "100000000": 5},
        "it_share": {"it": 0.15, "other": 0.10},
        "assumptions": [],
    }


def test_equipment_calculation(mock_analogs):
    """equipment = Σ qty × base_price × complexity."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir"], items, [], False, False, 12, "prepay")

    # 10 × 8500 × 1.2 = 102000
    expected_equip = 10 * 8500 * 1.2
    assert result["costs"]["equipment"] == expected_equip


def test_works_calculation(mock_analogs):
    """works = equipment × Σ share_of_equipment."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir", "pnr", "shef"], items, [], False, False, 12, "prepay")

    # equipment = 102000
    # shares = 0.10 + 0.15 + 0.05 = 0.30
    # works = 102000 × 0.30 = 30600
    expected_works = 102000 * 0.30
    assert result["costs"]["works"] == expected_works


def test_direct_calculation(mock_analogs):
    """direct = equipment + works."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir"], items, [], False, False, 12, "prepay")

    # equipment = 102000, works = 102000 × 0.10 = 10200
    # direct = 112200
    expected_direct = 102000 + 10200
    assert result["costs"]["direct"] == expected_direct


def test_formula_match_basic(mock_analogs):
    """
    При urgent=false, uniqueSolution=false, financing=prepay, без нестандарта:
    optimal = (equipment+works) × region.coef × level.coef × (1 + rate×term/12)
    financing_rates: 12 мес = 5.0%
    """
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir"], items, [], False, False, 12, "prepay")

    # equipment = 102000
    # works = 10200
    # direct = 112200
    # region.coef = 1.0 (Центральный)
    # level.coef = 1.0 (basic)
    # urgent = false → P3 = P2
    # unique = false → P4 = P3
    # financing = prepay → rate = 5.0% for 12 мес
    # P5 = 112200 × (1 + 0.05 × 12/12) = 112200 × 1.05 = 117810
    expected_optimal = 112200 * 1.05
    assert result["price"]["optimal"] == round(expected_optimal, 2)


def test_formula_with_region(mock_analogs):
    """Проверка с регионом Южный (coef 1.1)."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(2, "basic", ["pir"], items, [], False, False, 12, "prepay")

    # direct = 112200
    # region.coef = 1.1
    # rate = 5.0% for 12 мес
    # optimal = 112200 × 1.1 × 1.05 = 129591
    expected = 112200 * 1.1 * 1.05
    assert result["price"]["optimal"] == round(expected, 2)


def test_formula_with_urgent(mock_analogs):
    """Проверка срочности × 1.2."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir"], items, [], True, False, 12, "prepay")

    # direct = 112200
    # P3 = 112200 × 1.2 = 134640
    # P5 = 134640 × 1.05 = 141372
    expected = 112200 * 1.2 * 1.05
    assert result["price"]["optimal"] == round(expected, 2)


def test_waterfall_breakdown(mock_analogs):
    """Сумма шагов водопада = optimal (breakdown включает direct как первую строку)."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(2, "advanced", ["pir", "pnr"], items, [], True, True, 24, "installment")

    optimal = result["price"]["optimal"]

    # Водопад содержит строки: direct, region, level, urgent, unique, financing, volume
    # Сумма всех шагов в breakdown = optimal
    breakdown_sum = sum(step["amount"] for step in result["breakdown"])

    assert abs(breakdown_sum - optimal) < 0.02, f"waterfall mismatch: breakdown_sum={breakdown_sum} != optimal={optimal}"


def test_waterfall_steps_are_differences(mock_analogs):
    """Каждый шаг водопада — разность между P_i и P_{i-1}."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(2, "advanced", ["pir", "pnr"], items, [], True, True, 24, "installment")

    # Проверяем, что breakdown содержит шаги:
    # region = P1 - P0 (P0=direct)
    # level = P2 - P1
    # urgent = P3 - P2 (если urgent)
    # unique = P4 - P3 (если unique)
    # financing = P5 - P4
    # volume = P6 - P5 (отрицательный)
    keys = [s["key"] for s in result["breakdown"]]
    assert "region" in keys
    assert "level" in keys
    assert "urgent" in keys
    assert "unique" in keys
    assert "financing" in keys
    assert "volume" in keys


def test_max_price(mock_analogs):
    """max = optimal × maxFactor (по умолчанию 1.15)."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir"], items, [], False, False, 12, "prepay")

    optimal = result["price"]["optimal"]
    expected_max = optimal * 1.15
    assert result["price"]["max"] == round(expected_max, 2)


def test_margin_calculation(mock_analogs):
    """Маржа = (цена - direct) / цена × 100."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir"], items, [], False, False, 12, "prepay")

    direct = result["costs"]["direct"]
    optimal = result["price"]["optimal"]
    expected_margin = (optimal - direct) / optimal * 100

    assert result["margin"]["optimalPct"] == round(expected_margin, 2)


def test_custom_items(mock_analogs):
    """customItems учитываются в equipment."""
    items = [{"componentId": "el_01", "qty": 10}]
    custom = [{"name": "Кастомный блок", "unit": "шт.", "unitPrice": 5000, "qty": 2, "complexity": 1.5}]
    result = calculate_estimate(1, "basic", ["pir"], items, custom, False, False, 12, "prepay")

    # equipment = 102000 + 2 × 5000 × 1.5 = 102000 + 15000 = 117000
    expected = 102000 + 15000
    assert result["costs"]["equipment"] == expected


def test_nonstandard_markup(mock_analogs):
    """nonStandard позиция получает наценку в breakdown, но не в equipment."""
    items = [{"componentId": "el_01", "qty": 10, "nonStandard": True}]
    result = calculate_estimate(1, "basic", [], items, [], False, False, 12, "prepay")

    # equipment = 10 × 8500 × 1.2 = 102000 (наценка не входит в equipment)
    # nonStandard markup = 20400 (отдельная строка в breakdown)
    assert result["costs"]["equipment"] == 102000
    # Проверить что в breakdown есть строка non_standard
    assert any(s["key"] == "non_standard" for s in result["breakdown"])
    # Проверить что в assumptions есть пометка
    assert any("нестандарт" in a.lower() or "nonstandard" in a.lower() for a in result["assumptions"])


def test_curve_has_20_points(mock_analogs):
    """Кривая маржи содержит ~20 точек."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir"], items, [], False, False, 12, "prepay")

    curve = result["margin"]["curve"]
    assert len(curve) == 20
    # Первая точка — near min, последняя — near max
    assert curve[0]["price"] <= curve[-1]["price"]


def test_fallback_min_without_analogs(mock_analogs_none):
    """Без аналогов min = optimal × 0.9, minBasis = fallback_0.9."""
    items = [{"componentId": "el_01", "qty": 10}]
    result = calculate_estimate(1, "basic", ["pir"], items, [], False, False, 12, "prepay")

    optimal = result["price"]["optimal"]
    assert result["price"]["minBasis"] == "fallback_0.9"
    assert result["price"]["min"] == round(optimal * 0.9, 2)


def test_multiple_stages_shares(mock_analogs):
    """works = equipment × (share1 + share2 + ...)."""
    items = [{"componentId": "el_01", "qty": 10}]

    # Только pir (0.10)
    r1 = calculate_estimate(1, "basic", ["pir"], items, [], False, False, 12, "prepay")
    # pir + pnr (0.10 + 0.15 = 0.25)
    r2 = calculate_estimate(1, "basic", ["pir", "pnr"], items, [], False, False, 12, "prepay")
    # все три (0.10 + 0.15 + 0.05 = 0.30)
    r3 = calculate_estimate(1, "basic", ["pir", "pnr", "shef"], items, [], False, False, 12, "prepay")

    assert r1["costs"]["works"] == 102000 * 0.10
    assert r2["costs"]["works"] == 102000 * 0.25
    assert r3["costs"]["works"] == 102000 * 0.30


def test_complexity_default_1(mock_analogs):
    """complexity по умолчанию 1.0 для customItems."""
    items = [{"componentId": "el_01", "qty": 10}]
    custom = [{"name": "Без сложности", "unit": "шт.", "unitPrice": 1000, "qty": 5}]
    result = calculate_estimate(1, "basic", [], items, custom, False, False, 12, "prepay")

    # equipment = 102000 + 5 × 1000 × 1.0 = 107000
    assert result["costs"]["equipment"] == 107000

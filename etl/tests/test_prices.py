"""Парсинг цен на сохранённых файлах: PDF Ростелекома (data/prices/) и выдача tinko.ru (fixtures/).
Цены сверены с теми, что вручную занесены в infra/db/init/07_calc_rt_catalog.sql.

    pip install -r etl/requirements.txt pytest && python -m pytest etl/tests
"""
import gzip
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from etl import prices  # noqa: E402

FIX = Path(__file__).parent / "fixtures"


def parsed(key):
    text, meta = prices.read_pdf((ROOT / "data" / "prices" / prices.RT_PRICES[key][2]).read_bytes())
    return {p.component_id or p.model: p.price for p in prices.PARSERS[key](text)}, prices.pdf_date(text, meta)


def test_video_price():
    p, d = parsed("video")
    assert d == date(2026, 6, 1)
    # камеры — по модели, как в прайсе; 11 моделей
    assert p["Uniview 3F22P-RB28"] == 4982
    assert p["Qtech HFW1230SPv2"] == 6202          # с рассрочкой: берём цену покупки, а не 743 ₽/мес.
    assert p["Dahua K42LB"] == 5897                # без рассрочки («—»)
    assert p["Dahua HFW3441EP-SA"] == 15454
    assert sum(1 for k in p if not k.startswith(("cam_", "vs_"))) == 11
    assert p["cam_06"] == 5000
    assert (p["vs_01"], p["vs_02"], p["vs_03"]) == (525, 1050, 3150)
    assert (p["vs_04"], p["vs_05"], p["vs_06"]) == (3514, 2928, 4880)


def test_vats_price():
    p, d = parsed("vats")
    assert d == date(2026, 5, 1)
    assert [p[f"vats_0{i}"] for i in range(1, 5)] == [1100, 2000, 4100, 8800]
    assert (p["vats_05"], p["vats_06"], p["vats_07"]) == (350, 510, 750)


def test_wifi_price_date_from_metadata():
    p, d = parsed("wifi")
    assert d == date(2026, 6, 15)                   # строки «действуют с» нет — дата создания PDF
    assert (p["wf_01"], p["wf_02"], p["wf_03"]) == (5000, 2100, 2700)


@pytest.mark.parametrize("model, series", [
    ("Qtech HFW1230SPv2", "HFW1230"),
    ("Dahua HDW2431TP-AS", "HDW2431"),
    ("Uniview 3F22P-RB28", "3F22"),
    ("Rotek Switcam-QT400", None),                   # серии не выделить — без рыночного аналога
])
def test_model_series(model, series):
    assert prices.model_series(model) == series


def test_camera_id_matches_catalog_or_creates_new():
    catalog = {"cam_02": "IP-камера Qtech HFW1230SPv2", "cam_03": "IP-камера Rotek Switcam-QT400 (для помещений)"}
    assert prices._camera_id("Qtech HFW1230SPv2", catalog) == ("cam_02", False)
    assert prices._camera_id("Rotek Switcam-QT400", catalog) == ("cam_03", False)
    assert prices._camera_id("Dahua HFW1230SP", catalog) == ("cam_dahuahfw1230sp", True)   # другой бренд — другая камера


def test_tinko_only_cameras_of_series_with_price():
    page = gzip.decompress((FIX / "tinko_HFW1230.html.gz").read_bytes()).decode("utf-8")
    offers = prices.parse_tinko(page, "HFW1230")
    assert offers, "выдача tinko не разобрана — вёрстка изменилась?"
    assert all("HFW1230" in prices.norm_model(name) for name, _, _ in offers)
    assert all(price > 0 and url.startswith("https://www.tinko.ru/catalog/product/") for _, price, url in offers)
    assert ("DH-IPC-HFW1230S1P-0280B-S6", 3207.9, "https://www.tinko.ru/catalog/product/341380/") in offers


def test_tinko_no_false_analogs():
    # По «HDW2431» магазин отдаёт соседние серии (HDW1431, HDW2849) и кабели с артикулом «2431» — это не аналоги
    page = gzip.decompress((FIX / "tinko_HDW2431.html.gz").read_bytes()).decode("utf-8")
    assert prices.parse_tinko(page, "HDW2431") == []
    assert all("HDW1431" in prices.norm_model(n) for n, _, _ in prices.parse_tinko(page, "HDW1431"))

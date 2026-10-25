"""Парсинг цен для калькулятора (кейс, слайд 3: «парсинг цен на оборудование/ПО»).

1. Прайс-листы Ростелекома для юрлиц (PDF) -> calc.component.base_price, price_source/date.
   Камеры, которых ещё нет в каталоге, добавляются (новые модели в прайсе — новые позиции).
   Сеть недоступна — разбираем копии из data/prices/ (демо работает без интернета).
2. tinko.ru — рыночная цена аналога той же серии модели (у Ростелекома названия короткие или устаревшие,
   в магазине — новые ревизии серии) -> calc.component.market_*. Не ответил — прежние значения не трогаем.

Позиции МОД3 из таблицы кейса не меняются. Итог запуска — etl.price_run.
"""
import gzip
import html
import io
import logging
import re
import statistics
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path

from psycopg.types.json import Jsonb

log = logging.getLogger("etl.prices")

UA = "Mozilla/5.0 (compatible; radar-hackathon price parser; +https://rostov.rt.ru)"
TIMEOUT = 30
CAMERA_GROUP = "Видеонаблюдение: камеры и монтаж"

# Прайс -> откуда качать, где копия, как разобрать
RT_PRICES = {
    "video": ("rt.ru: прайс «Видеонаблюдение для бизнеса»",
              "https://rt-static.rt.ru/sites/default/files/b2b/videonablyudenie/docs/price.pdf", "rt_video.pdf"),
    "vats": ("rt.ru: прайс «Виртуальная АТС»",
             "https://rt-static.rt.ru/sites/default/files/b2b/VATS/VATS_price.pdf", "rt_vats.pdf"),
    "wifi": ("rt.ru: прайс «Wi-Fi для гостей»",
             "https://rt-static.rt.ru/sites/default/files/b2b/Wi-Fi/wi-fi-price.pdf", "rt_wifi.pdf"),
}
TINKO_SEARCH = "https://www.tinko.ru/search/?q="


@dataclass
class Price:
    component_id: str | None      # None — новая модель камеры, id и название задаст apply()
    price: float
    model: str | None = None      # для камер: «Qtech HFW1230SPv2»


# ---------------------------------------------------------------- разбор PDF Ростелекома

# Число строго по разрядам («15 454», «1100»): иначе сноска, приклеенная к тексту, сливается с ценой —
# «за 1 камеру² 5 000 ₽» извлекается как «камеру2 5 000 ₽» и читалось бы как 25 000
_RUB = r"(\d{1,3}(?:[  ]\d{3})+|\d+)\s*₽"


def _rub(s):
    return float(re.sub(r"[\s ]", "", s))


def _line_price(text, pattern):
    """Цена из строки, где есть pattern: «Подсчет посетителей, в месяц 3 514 ₽» -> 3514."""
    m = re.search(pattern + r"[^\n]*?" + _RUB + r"\s*$", text, re.M | re.I)
    return _rub(m.group(1)) if m else None


def _row_prices(text, pattern):
    """Все цены строки таблицы: «Абонентская плата … 1100 ₽ 2000 ₽ 4100 ₽ 8800 ₽» -> [1100, 2000, 4100, 8800]."""
    m = re.search(pattern + r"([^\n]*)", text, re.I)
    return [_rub(x) for x in re.findall(_RUB, m.group(1))] if m else []


def pdf_date(text, metadata_date=None):
    """«Тарифы действуют с 01.06.2026» -> date; в прайсе Wi-Fi строки нет — дата создания PDF."""
    m = re.search(r"действуют с (\d{2})\.(\d{2})\.(\d{4})", text)
    if m:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    return metadata_date.date() if metadata_date else None


def parse_video(text):
    out = []
    # «Qtech HFW1230SPv2 743 ₽/мес. 6 202 ₽» | «Dahua K42LB — 5 897 ₽»: модель, [рассрочка], покупка
    section = text.split("Оборудование", 1)[-1].split("Примечания", 1)[0]
    for m in re.finditer(r"^([A-Za-z][\w\- ]*?)\s+(?:—|\d[\d\s]*₽/мес\.)\s+" + _RUB + r"\s*$", section, re.M):
        out.append(Price(None, _rub(m.group(2)), model=m.group(1).strip()))
    for cid, pat in [("cam_06", r"Подключение услуги и установка камеры"),
                     ("vs_04", r"Подсчет посетителей"),
                     ("vs_05", r"Распознавание номеров автомобилей на скорости до 30"),
                     ("vs_06", r"Распознавание лиц")]:
        p = _line_price(text, pat)
        if p is not None:
            out.append(Price(cid, p))
    for cid, days in [("vs_01", 7), ("vs_02", 30), ("vs_03", 90)]:   # «30 суток 20 часов 1 050 ₽»
        m = re.search(rf"^{days} суток \d+ час\w*\s+" + _RUB, text, re.M)
        if m:
            out.append(Price(cid, _rub(m.group(1))))
    return out


def parse_vats(text):
    out = []
    fees = _row_prices(text, r"Абонентская плата за услугу в месяц")       # 4 тарифа по порядку
    out += [Price(f"vats_0{i}", p) for i, p in enumerate(fees[:4], 1)]
    for cid, pat in [("vats_05", r"Запись и 12 месяцев хранения"),
                     ("vats_06", r"Интеграция с CRM"),
                     ("vats_07", r"Городской или мобильный без категории")]:
        p = _line_price(text, pat)
        if p is not None:
            out.append(Price(cid, p))
    return out


def parse_wifi(text):
    out = []
    fees = _row_prices(text, r"Абонентская плата за услугу в месяц")       # Начальный, Улучшенный, Расширенный
    if len(fees) >= 3:
        out += [Price("wf_02", fees[1]), Price("wf_03", fees[2])]
    setup = _row_prices(text, r"и настройку оборудования Wi-Fi")            # перенос строки в заголовке
    if len(setup) >= 2:
        out.append(Price("wf_01", setup[1]))
    return out


PARSERS = {"video": parse_video, "vats": parse_vats, "wifi": parse_wifi}


def read_pdf(data):
    from pypdf import PdfReader          # тяжёлый импорт — только когда парсим
    r = PdfReader(io.BytesIO(data))
    text = "\n".join(p.extract_text() or "" for p in r.pages)
    meta = r.metadata.creation_date if r.metadata else None
    return text, meta


# ---------------------------------------------------------------- рыночный аналог: tinko.ru

def norm_model(s):
    return re.sub(r"[^A-Z0-9]", "", (s or "").upper())


def model_series(model):
    """Серия модели для поиска аналога: «Qtech HFW1230SPv2» -> HFW1230, «Uniview 3F22P-RB28» -> 3F22."""
    code = model.split()[-1].upper()
    m = re.search(r"([A-Z]{2,4}\d{4})", code) or re.search(r"(\d[A-Z]\d{2})", code)
    return m.group(1) if m else None


def parse_tinko(page, series):
    """Видеокамеры серии из выдачи поиска: [(модель, цена, url)]. Аксессуары и «0 рублей» отбрасываются."""
    out = []
    for card in page.split('<div class="catalog-product"')[1:]:
        title = re.search(r'catalog-product__title[^>]*><a href="([^"]+)"[^>]*>([^<]+)<', card)
        sub = re.search(r'catalog-product__subtitle[^>]*>([^<]*)<', card)
        price = re.search(r'total-value[^>]*>([\d\s ]+(?:,\d+)?)', card)
        if not (title and price and sub) or "камер" not in sub.group(1).lower():
            continue
        name = html.unescape(title.group(2)).strip()
        value = float(re.sub(r"[\s ]", "", price.group(1)).replace(",", "."))
        if value > 0 and series in norm_model(name):
            out.append((name, value, "https://www.tinko.ru" + title.group(1)))
    return out


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        data = r.read()
    return gzip.decompress(data) if data[:2] == b"\x1f\x8b" else data


# ---------------------------------------------------------------- запись в БД

def _camera_id(model, existing):
    """Камера из прайса -> id в каталоге: по модели в названии; новой — cam_<модель>."""
    key = norm_model(model)
    for cid, name in existing.items():
        if cid.startswith("cam_") and key and key in norm_model(name):
            return cid, False
    return "cam_" + key.lower()[:20], True


def apply_rt(cur, source, url, price_date, prices, now):
    existing = dict(cur.execute("SELECT id, name FROM calc.component").fetchall())
    updated, added = 0, []
    for p in prices:
        cid, new = (p.component_id, False) if p.component_id else _camera_id(p.model, existing)
        if new:
            cur.execute("INSERT INTO calc.component (id, system_group, name, unit, base_price, complexity) "
                        "VALUES (%s, %s, %s, 'шт.', %s, 1)", (cid, CAMERA_GROUP, f"IP-камера {p.model}", p.price))
            existing[cid] = f"IP-камера {p.model}"
            added.append(p.model)
        elif cid not in existing:
            continue                      # позиции нет в каталоге (07_calc_rt_catalog.sql не применён) — пропускаем
        cur.execute("UPDATE calc.component SET base_price = %s, price_source = %s, price_url = %s, price_date = %s, "
                    "price_checked_at = %s WHERE id = %s", (p.price, source, url, price_date, now, cid))
        updated += 1
    return updated, added


def run_market(cur, now, fetch_page=fetch, pause=1.0):
    """Аналоги для всех камер каталога. Один запрос на серию, пауза между запросами — бережём магазин."""
    cams = cur.execute("SELECT id, name FROM calc.component WHERE id LIKE 'cam\\_%' AND name LIKE 'IP-камера %'").fetchall()
    found, missing, errors, cache = 0, [], [], {}
    for cid, name in cams:
        series = model_series(name.removeprefix("IP-камера "))
        if not series:
            missing.append(name)
            continue
        if series not in cache:
            try:
                cache[series] = parse_tinko(fetch_page(TINKO_SEARCH + urllib.parse.quote(series)).decode("utf-8", "replace"),
                                            series)
            except Exception as e:                      # магазин не ответил или капча — прежние цены остаются
                errors.append(f"{series}: {e}")
                cache[series] = None
            time.sleep(pause)
        offers = cache[series]
        if not offers:
            missing.append(name)
            continue
        cheapest = min(offers, key=lambda o: o[1])
        median = f"{statistics.median(o[1] for o in offers):,.0f}".replace(",", "\u00a0")
        note = f"серия {series}, {len(offers)} предл., медиана {median} ₽"
        cur.execute("UPDATE calc.component SET market_price = %s, market_source = 'tinko.ru', market_note = %s, "
                    "market_url = %s, market_checked_at = %s WHERE id = %s", (cheapest[1], note, cheapest[2], now, cid))
        found += 1
    return {"found": found, "missing": missing, "errors": errors}


def run(conn, data_dir, fetch_url=fetch, market=True):
    """Весь парсинг одной транзакцией; итог — в etl.price_run. Возвращает details."""
    run_id = conn.execute("INSERT INTO etl.price_run DEFAULT VALUES RETURNING id").fetchone()[0]
    conn.commit()
    details = {"rt": {}, "market": None}
    try:
        with conn.transaction():
            cur = conn.cursor()
            now = datetime.now().astimezone()
            for key, (source, url, local) in RT_PRICES.items():
                try:
                    data, origin = fetch_url(url), "online"
                except Exception as e:
                    log.warning("прайс %s недоступен (%s) — разбираем копию data/prices/%s", key, e, local)
                    data, origin = (Path(data_dir) / "prices" / local).read_bytes(), "копия из репозитория"
                text, meta = read_pdf(data)
                prices = PARSERS[key](text)
                d = pdf_date(text, meta)
                updated, added = apply_rt(cur, source, url, d, prices, now)
                details["rt"][key] = {"origin": origin, "date": d.isoformat() if d else None,
                                      "parsed": len(prices), "updated": updated, "added": added}
                if not prices:
                    log.warning("WARN: в прайсе %s не распознано ни одной цены — формат PDF изменился?", key)
            if market:
                details["market"] = run_market(cur, now)
        status = "ok"
    except Exception as e:
        log.exception("парсинг цен")
        details["error"] = str(e)
        status = "failed"
    conn.execute("UPDATE etl.price_run SET finished_at = clock_timestamp(), status = %s, details = %s WHERE id = %s",
                 (status, Jsonb(details), run_id))
    conn.commit()
    log.info("цены: %s %s", status, details)
    return status, details

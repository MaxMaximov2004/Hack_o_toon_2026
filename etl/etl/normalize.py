"""Нормализация сырья: муниципалитеты, ОКВЭД, даты, ИНН, справочные значения."""
import csv
import re
from datetime import date

_LOWER_PARTS = {"на", "в"}
_CITY = re.compile(r"^(?:городской округ\s+|город\s+|г\.\s*)(.+)$")
_DISTRICT = re.compile(r"^(.+?)\s*(?:район|р-н)\.?$")


def _cap(name):
    """'ростов-на-дону' -> 'Ростов-на-Дону' (на, в — со строчной)."""
    words = []
    for w in name.split(" "):
        words.append("-".join(p if p in _LOWER_PARTS else p[:1].upper() + p[1:] for p in w.split("-")))
    return " ".join(words)


def norm_municipality(district, city):
    """(район, город) -> ('Аксайский р-н' | 'г. Таганрог', 'district' | 'city') или None.

    Источник — district, если не пуст, иначе city. Без явной пометки («район», «р-н», «г.»):
    значение из city считаем городом, из district — районом.
    """
    d = " ".join((district or "").split())
    c = " ".join((city or "").split())
    src, from_city = (d, False) if d else (c, True)
    if not src:
        return None
    s = src.lower()
    m = _CITY.match(s)
    if m:
        return "г. " + _cap(m.group(1).strip()), "city"
    m = _DISTRICT.match(s)
    if m:
        return _cap(m.group(1).strip()) + " р-н", "district"
    if from_city:
        return "г. " + _cap(s), "city"
    return _cap(s) + " р-н", "district"


def parse_date(s):
    s = (s or "").strip()
    m = re.match(r"^(\d{2})\.(\d{2})\.(\d{4})", s)
    if m:
        y, mo, d = int(m.group(3)), int(m.group(2)), int(m.group(1))
    else:
        m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
        if not m:
            return None
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    try:
        return date(y, mo, d)
    except ValueError:
        return None


def parse_num(s):
    s = re.sub(r"[\s\u00a0]", "", str(s if s is not None else "")).replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_int(s):
    v = parse_num(s)
    return None if v is None else int(v)


def clean_text(s):
    return " ".join((s or "").split())


def yes(v):
    return (v or "").strip().lower() in ("да", "yes", "true", "1", "+", "y")


def fix_inn(raw, subject_type):
    """Вернуть ведущий ноль, потерянный Excel'ом (как в prepare_rmsp.py)."""
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return ""
    want = 12 if "предприниматель" in (subject_type or "").lower() else 10
    return digits.zfill(want) if len(digits) < want else digits


def subject_type_of(s):
    return "ip" if "предприниматель" in (s or "").lower() else "legal"


def size_of(s):
    t = (s or "").lower()
    if t.startswith("микро"):
        return "micro"
    if t.startswith("мал"):
        return "small"
    if t.startswith("средн"):
        return "medium"
    return None


def split_okved(s):
    """'33.12 Ремонт машин' -> ('33.12', 'Ремонт машин')."""
    s = clean_text(s)
    if not s:
        return None, None
    code, _, rest = s.partition(" ")
    if re.match(r"^\d", code):
        return code, (rest or None)
    return None, s


def load_okved_industry(path):
    with open(path, encoding="utf-8", newline="") as f:
        return {r["prefix"].strip(): r["industry"].strip() for r in csv.DictReader(f)}


def industry_of(code, mapping):
    m = re.match(r"\d{2}", code or "")
    return mapping.get(m.group(), "other") if m else "other"

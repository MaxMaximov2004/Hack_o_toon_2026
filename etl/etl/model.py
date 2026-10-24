"""Координаты и модельная выручка. Вся «случайность» — от хэша ИНН: стабильно между запусками."""
import hashlib
import math

CURRENT_YEAR = 2026

MEDIAN = {
    ("micro", "ip"): 4e6,
    ("micro", "legal"): 15e6,
    ("small", "ip"): 250e6,
    ("small", "legal"): 250e6,
    ("medium", "ip"): 1.2e9,
    ("medium", "legal"): 1.2e9,
}
K_INDUSTRY = {
    "trade": 1.3, "energy": 1.4, "manufacturing": 1.2, "logistics": 1.1, "construction": 1.1,
    "agro": 1.0, "it": 0.9, "realestate": 0.8, "other": 0.8, "services": 0.7, "hospitality": 0.6,
}
# micro ≤ 120 млн, small 120–800 млн, medium 800 млн – 2 млрд. Нижнюю границу micro (0,5 млн) добавили сами,
# чтобы не получать выручку в десятки тысяч рублей.
BOUNDS = {"micro": (0.5e6, 120e6), "small": (120e6, 800e6), "medium": (800e6, 2e9)}


def u(inn, salt):
    """0..1, зависит только от ИНН и соли."""
    return int(hashlib.sha256((inn + salt).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def jitter_point(inn, lat0, lon0, radius):
    """Точка в круге радиуса `radius` градусов вокруг центра (равномерно по площади)."""
    r = radius * math.sqrt(u(inn, "r"))
    phi = 2 * math.pi * u(inn, "phi")
    lat = lat0 + r * math.cos(phi)
    lon = lon0 + r * math.sin(phi) / math.cos(math.radians(lat0))
    return round(lat, 6), round(lon, 6)


def revenue_model(inn, size, subject_type, industry, employees):
    if employees and employees > 0:
        median = employees * 3e6
    else:
        median = MEDIAN[(size, subject_type)]
    rev = median * K_INDUSTRY.get(industry, 0.8) * math.exp(0.6 * (u(inn, "rev") - 0.5) * 2)
    lo, hi = BOUNDS[size]
    return round(min(max(rev, lo), hi), 2)


def growth_model(inn, registered_at):
    if registered_at is None:
        base = 12.0
    else:
        age = CURRENT_YEAR - registered_at.year
        base = 25.0 if age < 2 else 12.0 if age <= 5 else 5.0
    return round(base + 16 * (u(inn, "g") - 0.5), 1)


# Рост по ФНС считаем, только если доход в обоих годах не меньше 1 млн ₽: на маленькой базе выходят тысячи процентов
# (0,1 → 10 млн = +9900 %). За пределами −90…+300 % — запуски, реорганизации и сворачивание бизнеса: значение реальное,
# но в сортировке «по росту» такие компании забивают весь верх списка, поэтому ограничиваем.
GROWTH_MIN_INCOME = 1_000_000
GROWTH_LIMITS = (-90.0, 300.0)


def growth_fns(cur, prev):
    """Рост год к году по данным ФНС, %; None — по ФНС честно не посчитать (нет прошлого года или база меньше 1 млн)."""
    if prev is None or prev < GROWTH_MIN_INCOME or cur < GROWTH_MIN_INCOME:
        return None
    lo, hi = GROWTH_LIMITS
    return round(max(lo, min(hi, (cur / prev - 1) * 100)), 2)

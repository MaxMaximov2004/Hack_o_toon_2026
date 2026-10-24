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


# Модельный рост откалиброван по реальному росту ФНС 2024→2025 (~22 тыс. юрлиц области): квартили по отрасли
# и поправка для молодых компаний. Пересчитать: cd etl && python tools/calibrate_growth.py — и вставить сюда.
GROWTH_DEFAULT = (-28.4, 0.5, 30.1)
GROWTH_BY_INDUSTRY = {   # (p25, медиана, p75), % год к году
    "trade": (-34.1, -6.3, 22.7),   # n=7528
    "services": (-14.6, 11.1, 39.7),   # n=3840
    "manufacturing": (-25.3, -0.8, 27.8),   # n=2703
    "construction": (-39.1, 1.2, 58.9),   # n=2381
    "realestate": (-7.2, 6.7, 20.8),   # n=1845
    "logistics": (-38.1, -6.0, 26.9),   # n=1439
    "it": (-13.5, 10.8, 35.9),   # n=779
    "agro": (-49.0, -23.9, 6.0),   # n=693
    "hospitality": (-17.3, 1.5, 28.2),   # n=680
    "energy": (-24.0, 2.8, 33.6),   # n=192
    "other": (-31.7, 1.8, 36.5),   # n=132
}
GROWTH_YOUNG_YEARS = 5   # «молодая» — в реестре МСП не дольше 5 лет
GROWTH_YOUNG_BONUS = 9   # медиана молодых 8.8 % (n=4913) против -0.7 % (n=17299), п. п.


def growth_model(inn, registered_at, industry):
    """Рост, %: точка между квартилями отрасли по хэшу ИНН (медиана — в центре) + поправка для молодых.
    Все модельные значения — внутри межквартильного диапазона отрасли: оценка не выдумывает крайних значений,
    они есть только в реальных данных ФНС. Стабильно между запусками."""
    p25, p50, p75 = GROWTH_BY_INDUSTRY.get(industry, GROWTH_DEFAULT)
    x = u(inn, "g")
    g = p25 + (p50 - p25) * 2 * x if x < 0.5 else p50 + (p75 - p50) * 2 * (x - 0.5)
    if registered_at is not None and CURRENT_YEAR - registered_at.year <= GROWTH_YOUNG_YEARS:
        g += GROWTH_YOUNG_BONUS
    return round(g, 1)


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

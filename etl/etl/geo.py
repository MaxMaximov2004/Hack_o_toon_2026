"""Размещение компании на карте. Адресов в реестре нет, поэтому точка — реальное здание из OSM.

Порядок: здание в населённом пункте (settlements.json) -> здание в районе / городском округе (граница из OSM)
-> старый вариант, случайная точка у центроида. Здание выбирается по хэшу ИНН — при перезагрузке точка та же;
чем плотнее застройка, тем больше там компаний, как и в жизни.
"""
import csv
import gzip
import math

from . import model

CELL = 0.02                 # ячейка сетки, градусы (~2 км)
KM_PER_DEG = 111.32
TOWN_RADIUS_KM = 4.0        # город внутри района (Аксай, Сальск)
VILLAGE_RADIUS_KM = 2.0     # посёлок, хутор, станица
SPREAD = 0.00007            # до ~8 м от центра здания, чтобы компании одного дома не слипались в одну точку


class Buildings:
    def __init__(self, path=None):
        self.by_muni, self.grid, self._near = {}, {}, {}
        if path is None or not path.exists():
            return
        with gzip.open(path, "rt", encoding="utf-8", newline="") as f:
            for r in csv.DictReader(f):
                p = (float(r["lat"]), float(r["lon"]))
                self.by_muni.setdefault(r["municipality"], []).append(p)
                self.grid.setdefault(r["municipality"], {}).setdefault(_cell(*p), []).append(p)

    def __len__(self):
        return sum(map(len, self.by_muni.values()))

    def in_muni(self, muni):
        return self.by_muni.get(muni, [])

    def near(self, muni, lat, lon, radius_km):
        key = (muni, lat, lon, radius_km)
        if key not in self._near:
            grid = self.grid.get(muni, {})
            klat = KM_PER_DEG
            klon = KM_PER_DEG * math.cos(math.radians(lat))
            r_cells = int(radius_km / (KM_PER_DEG * CELL * math.cos(math.radians(lat)))) + 1
            ci, cj = _cell(lat, lon)
            out = []
            for i in range(ci - r_cells, ci + r_cells + 1):
                for j in range(cj - r_cells, cj + r_cells + 1):
                    for p in grid.get((i, j), ()):
                        if math.hypot((p[0] - lat) * klat, (p[1] - lon) * klon) <= radius_km:
                            out.append(p)
            out.sort()
            self._near[key] = out
        return self._near[key]


def _cell(lat, lon):
    return int(math.floor(lat / CELL)), int(math.floor(lon / CELL))


def _pick(inn, candidates):
    lat, lon = candidates[int(model.u(inn, "b") * len(candidates)) % len(candidates)]
    dlat = (model.u(inn, "dy") * 2 - 1) * SPREAD
    dlon = (model.u(inn, "dx") * 2 - 1) * SPREAD / math.cos(math.radians(lat))
    return round(lat + dlat, 6), round(lon + dlon, 6)


def place(inn, buildings, muni, kind, center, settlement=None, settlement_center=None):
    """-> (lat, lon, geo_precision). muni/kind/center — муниципалитет; settlement_center — центроид нас. пункта."""
    if settlement_center:
        radius = TOWN_RADIUS_KM if settlement.startswith("г.") else VILLAGE_RADIUS_KM
        cand = buildings.near(muni, settlement_center[0], settlement_center[1], radius)
        if cand:
            return (*_pick(inn, cand), "settlement")
        # геокодер мог найти одноимённый хутор в другом районе — тогда зданий рядом нет, нас. пункту не верим
    cand = buildings.in_muni(muni)
    if cand:
        return (*_pick(inn, cand), "municipality")
    if settlement_center:                   # зданий района в файле нет вовсе — хотя бы около нас. пункта
        lat, lon = model.jitter_point(inn, settlement_center[0], settlement_center[1], 0.01)
        return lat, lon, "settlement"
    lat, lon = model.jitter_point(inn, center[0], center[1], 0.03 if kind == "city" else 0.08)
    return lat, lon, "approx"

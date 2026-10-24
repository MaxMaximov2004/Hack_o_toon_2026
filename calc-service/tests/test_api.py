"""Тесты API (через TestClient с моками)."""

import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from cryptography.hazmat.backends import default_backend


def _mock_catalog():
    return {
        "regions": [{"id": 1, "name": "Центральный", "coef": 1.0, "reason": ""}],
        "levels": [{"code": "basic", "name": "Базовый", "coef": 1.0, "description": ""}],
        "stages": [{"code": "pir", "name": "Проектирование", "share_of_equipment": 0.10}],
        "components": {"s": [{"id": "el_01", "name": "Счётчик", "unit": "шт.", "base_price": 100.0, "complexity": 1.0}]},
    }


def _mock_analogs():
    return {
        "available": True,
        "source": "test",
        "count": 10,
        "percentile": "p25",
        "distribution": {"p10": 50000, "p25": 80000, "p50": 120000, "p75": 180000, "p90": 250000},
        "nearest": [],
    }


def _make_rsa_pair():
    """Генерирует пару RSA и возвращает (private_key_pem, jwks_dict, kid)."""
    from cryptography.hazmat.primitives.asymmetric import rsa as rsa_mod
    from cryptography.hazmat.primitives import serialization
    import base64

    key = rsa_mod.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
    pub = key.public_key()
    priv_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )

    pn = pub.public_numbers()

    def int_to_b64(val):
        hex_str = format(val, 'x')
        if len(hex_str) % 2:
            hex_str = '0' + hex_str
        return base64.urlsafe_b64encode(bytes.fromhex(hex_str)).rstrip(b'=').decode()

    # e в JWKS — это base64url-encoded целое число
    e_b64 = int_to_b64(pn.e)

    jwks = {
        "keys": [
            {"kty": "RSA", "kid": "test-1", "use": "sig", "n": int_to_b64(pn.n), "e": e_b64}
        ]
    }
    return priv_pem, jwks, "test-1"


_PRIV, _JWKS, _KID = _make_rsa_pair()


def _make_token(payload=None):
    """Создаёт валидный JWT токен."""
    import jwt
    import time
    if payload is None:
        payload = {
            "iss": "radar-auth", "sub": "1", "amr": ["pwd", "otp"],
            "iat": int(time.time()), "exp": int(time.time()) + 3600,
        }
    return jwt.encode(payload, _PRIV, algorithm="RS256", headers={"kid": _KID})


def _auth_header():
    return {"Authorization": f"Bearer {_make_token()}"}


class TestCatalogEndpoint:
    """Тест /api/calc/catalog."""

    def test_catalog_returns_structure(self, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.main.load_pricing_params", return_value={
                "unique_markup": 15, "non_standard_markup": 20, "max_factor": 1.15, "min_margin": 10,
                "financing_rates": {"12": 5.0}, "volume_discounts": {"1000000": 0},
                "it_share": {"it": 0.15}, "assumptions": [],
            }):
                resp = client.get("/api/calc/catalog")
                assert resp.status_code == 200
                data = resp.json()
                assert "regions" in data
                assert "levels" in data
                assert "stages" in data
                assert "components" in data
                assert "pricingParams" in data


class TestEstimateEndpoint:
    """Тест POST /api/calc/estimate."""

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_estimate_success(self, mock_fetch, client, mock_analogs):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.auth._jwks", _JWKS):
                resp = client.post("/api/calc/estimate", json={
                    "regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 5}]
                }, headers=_auth_header())
                assert resp.status_code == 200
                data = resp.json()
                assert "items" in data
                assert "costs" in data
                assert "price" in data
                assert "margin" in data
                assert "breakdown" in data
                assert "analogs" in data
                assert "assumptions" in data

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_estimate_validation_unknown_region(self, mock_fetch, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.auth._jwks", _JWKS):
                resp = client.post("/api/calc/estimate", json={
                    "regionId": 999, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]
                }, headers=_auth_header())
                assert resp.status_code == 400
                assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_estimate_validation_unknown_level(self, mock_fetch, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.auth._jwks", _JWKS):
                resp = client.post("/api/calc/estimate", json={
                    "regionId": 1, "level": "unknown", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]
                }, headers=_auth_header())
                assert resp.status_code == 400
                assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_estimate_validation_unknown_stage(self, mock_fetch, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.auth._jwks", _JWKS):
                resp = client.post("/api/calc/estimate", json={
                    "regionId": 1, "level": "basic", "stages": ["unknown"], "items": [{"componentId": "el_01", "qty": 1}]
                }, headers=_auth_header())
                assert resp.status_code == 400
                assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_estimate_validation_unknown_component(self, mock_fetch, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.auth._jwks", _JWKS):
                resp = client.post("/api/calc/estimate", json={
                    "regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "nonexistent", "qty": 1}]
                }, headers=_auth_header())
                assert resp.status_code == 400
                assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_estimate_validation_duplicate_items(self, mock_fetch, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.auth._jwks", _JWKS):
                resp = client.post("/api/calc/estimate", json={
                    "regionId": 1, "level": "basic", "stages": ["pir"],
                    "items": [{"componentId": "el_01", "qty": 1}, {"componentId": "el_01", "qty": 2}]
                }, headers=_auth_header())
                assert resp.status_code == 400
                assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_estimate_validation_qty_zero(self, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            token = _make_token()
            resp = client.post("/api/calc/estimate", json={
                "regionId": 1, "level": "basic", "stages": ["pir"],
                "items": [{"componentId": "el_01", "qty": 0}]
            }, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 400

    def test_estimate_validation_qty_too_large(self, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            token = _make_token()
            resp = client.post("/api/calc/estimate", json={
                "regionId": 1, "level": "basic", "stages": ["pir"],
                "items": [{"componentId": "el_01", "qty": 200000}]
            }, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 400

    def test_estimate_validation_too_many_items(self, client):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            token = _make_token()
            items = [{"componentId": "el_01", "qty": 1} for _ in range(201)]
            resp = client.post("/api/calc/estimate", json={
                "regionId": 1, "level": "basic", "stages": ["pir"], "items": items
            }, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 400


class TestHealthEndpoint:
    """Тест GET /health."""

    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestProposalEndpoint:
    """Тест POST /api/calc/proposal."""

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_proposal_returns_docx(self, mock_fetch, client, mock_analogs):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.auth._jwks", _JWKS):
                resp = client.post("/api/calc/proposal", json={
                    "regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 5}],
                    "client": {"name": "ООО Тест", "inn": "1234567890", "contact": "test@test.ru"}
                }, headers=_auth_header())
                assert resp.status_code == 200
                assert "application/vnd.openxmlformats" in resp.headers.get("content-type", "")
                assert "Content-Disposition" in resp.headers
                assert "radar_proposal_" in resp.headers["Content-Disposition"]
                assert len(resp.content) > 100
                assert resp.content[:2] == b"PK"


class TestCSVExport:
    """Тест POST /api/calc/export/csv."""

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_csv_returns_correct_format(self, mock_fetch, client, mock_analogs):
        with patch("app.main.get_catalog", return_value=_mock_catalog()):
            with patch("app.auth._jwks", _JWKS):
                resp = client.post("/api/calc/export/csv", json={
                    "regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 5}]
                }, headers=_auth_header())
                assert resp.status_code == 200
                assert "text/csv" in resp.headers.get("content-type", "")
                assert resp.content[:3] == b"\xef\xbb\xbf"
                assert resp.content[3:6] != b"\xef\xbb\xbf"   # BOM ровно один, иначе «﻿№» в первом заголовке
                text = resp.content.decode("utf-8")
                assert ";" in text
                assert "filename" in resp.headers.get("Content-Disposition", "")

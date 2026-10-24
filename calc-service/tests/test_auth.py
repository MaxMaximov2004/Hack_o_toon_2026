"""Тесты JWT-аутентификации."""

import base64
import time
from unittest.mock import patch, MagicMock

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa as rsa_mod
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.backends import default_backend

from app.main import app


def _make_rsa_pair():
    """Генерирует пару RSA и возвращает (private_key_pem, jwks_dict, kid)."""
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

    e_b64 = int_to_b64(pn.e)

    jwks = {
        "keys": [
            {"kty": "RSA", "kid": "test-1", "use": "sig", "n": int_to_b64(pn.n), "e": e_b64}
        ]
    }
    return priv_pem, jwks, "test-1"


_PRIV, _JWKS, _KID = _make_rsa_pair()


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


def _make_token(payload, private_key, kid="test-1"):
    """Создаёт JWT токен."""
    return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": kid})


def _make_hs256_token(payload, private_key):
    """Создаёт токен с alg=HS256 вместо RS256."""
    return jwt.encode(payload, private_key, algorithm="HS256", headers={"kid": "test-1"})


class TestJWTAuth:
    """Тесты JWT-валидации через /api/calc/estimate."""

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_no_authorization_header(self, mock_fetch, client):
        """Нет заголовка → 401."""
        with patch("app.auth._jwks", _JWKS):
            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]})
            assert resp.status_code == 401
            assert resp.json()["error"]["code"] == "UNAUTHORIZED"
            assert "Требуется вход" in resp.json()["error"]["message"]
            assert resp.headers.get("WWW-Authenticate") == "Bearer"

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_empty_authorization(self, mock_fetch, client):
        """Пустой Authorization → 401."""
        with patch("app.auth._jwks", _JWKS):
            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": ""})
            assert resp.status_code == 401

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_bad_bearer_format(self, mock_fetch, client):
        """Не Bearer формат → 401."""
        with patch("app.auth._jwks", _JWKS):
            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": "Basic abc"})
            assert resp.status_code == 401
            assert resp.json()["error"]["code"] == "UNAUTHORIZED"

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_hs256_rejected(self, mock_fetch, client):
        """HS256 отклоняется по заголовку."""
        with patch("app.auth._jwks", _JWKS):
            payload = {"iss": "radar-auth", "sub": "1", "amr": ["otp"], "iat": int(time.time()), "exp": int(time.time()) + 3600}
            # Для HS256 используем простой секрет
            token = jwt.encode(payload, "secret_key_for_hs256", algorithm="HS256", headers={"kid": "test-1"})

            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401
            assert resp.json()["error"]["code"] == "UNAUTHORIZED"

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_bad_signature(self, mock_fetch, client):
        """Плохая подпись → 401."""
        with patch("app.auth._jwks", _JWKS):
            other_key = rsa_mod.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())

            payload = {"iss": "radar-auth", "sub": "1", "amr": ["otp"], "iat": int(time.time()), "exp": int(time.time()) + 3600}
            token = jwt.encode(payload, other_key, algorithm="RS256", headers={"kid": "test-1"})

            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_expired_token(self, mock_fetch, client):
        """Истёкший токен → 401."""
        with patch("app.auth._jwks", _JWKS):
            payload = {"iss": "radar-auth", "sub": "1", "amr": ["otp"], "iat": int(time.time()) - 7200, "exp": int(time.time()) - 3600}
            token = _make_token(payload, _PRIV)

            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401
            assert "истёк" in resp.json()["error"]["message"].lower() or "expired" in resp.json()["error"]["message"].lower()

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_wrong_issuer(self, mock_fetch, client):
        """Чужой issuer → 401."""
        with patch("app.auth._jwks", _JWKS):
            payload = {"iss": "evil", "sub": "1", "amr": ["otp"], "iat": int(time.time()), "exp": int(time.time()) + 3600}
            token = _make_token(payload, _PRIV)

            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_missing_otp(self, mock_fetch, client):
        """amr без 'otp' → 401."""
        with patch("app.auth._jwks", _JWKS):
            payload = {"iss": "radar-auth", "sub": "1", "amr": ["pwd"], "iat": int(time.time()), "exp": int(time.time()) + 3600}
            token = _make_token(payload, _PRIV)

            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 401

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_unknown_kid(self, mock_fetch, client):
        """Неизвестный kid → 401/502."""
        with patch("app.auth._jwks", _JWKS):
            payload = {"iss": "radar-auth", "sub": "1", "amr": ["otp"], "iat": int(time.time()), "exp": int(time.time()) + 3600}
            token = jwt.encode(payload, _PRIV, algorithm="RS256", headers={"kid": "unknown-kid"})

            resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code in (401, 502)

    @patch("app.auth._fetch_jwks", side_effect=Exception("JWKS down"))
    def test_jwks_unavailable(self, mock_fetch, client):
        """JWKS недоступен за 5 с → 502."""
        payload = {"iss": "radar-auth", "sub": "1", "amr": ["otp"], "iat": int(time.time()), "exp": int(time.time()) + 3600}
        token = _make_token(payload, _PRIV)

        # Сбрасываем кэш JWKS
        import app.auth
        app.auth._jwks = None
        app.auth._jwks_ts = 0

        resp = client.post("/api/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 502
        assert resp.json()["error"]["code"] == "UPSTREAM_UNAVAILABLE"


class TestInternalEstimate:
    """Тесты внутреннего эндпоинта."""

    def test_internal_no_token(self, client):
        """Без X-Internal-Token → 401."""
        resp = client.post("/internal/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]})
        assert resp.status_code == 401

    def test_internal_wrong_token(self, client):
        """Неверный токен → 401."""
        resp = client.post("/internal/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"X-Internal-Token": "wrong"})
        assert resp.status_code == 401

    @patch("app.auth._fetch_jwks", return_value=_JWKS)
    def test_internal_correct_token(self, mock_fetch, client, mock_analogs):
        """Верный токен → 200."""
        from app.config import settings
        resp = client.post("/internal/calc/estimate", json={"regionId": 1, "level": "basic", "stages": ["pir"], "items": [{"componentId": "el_01", "qty": 1}]}, headers={"X-Internal-Token": settings.INTERNAL_TOKEN})
        assert resp.status_code == 200
        assert "costs" in resp.json()

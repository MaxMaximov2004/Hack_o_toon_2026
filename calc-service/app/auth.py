"""Проверка JWT (RS256, JWKS)."""

import base64
import time
from typing import Any

import httpx
import jwt
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers

from app.config import settings

_jwks: dict[str, Any] | None = None
_jwks_ts: float = 0
_jwks_cache = 600  # 10 мин

_last_unknown_kid: str = ""
_last_unknown_kid_ts: float = 0


def _fetch_jwks() -> dict[str, Any]:
    """Загружает JWKS из auth-service (синхронно, timeout 5 с)."""
    with httpx.Client(timeout=5.0) as client:
        resp = client.get(settings.AUTH_JWKS_URL)
        resp.raise_for_status()
        return resp.json()


def _get_public_key(kid: str | None):
    """Возвращает объект публичного ключа для kid (кэш 10 мин, один перезапрос для неизвестного kid)."""
    global _jwks, _jwks_ts, _last_unknown_kid, _last_unknown_kid_ts

    now = time.time()

    if _jwks is None or now - _jwks_ts > _jwks_cache:
        _jwks = _fetch_jwks()
        _jwks_ts = now

    key = _find_key_in_jwks(_jwks, kid)
    if key:
        return key

    # Unknown kid — один перезапрос
    if kid and (kid != _last_unknown_kid or now - _last_unknown_kid_ts > _jwks_cache):
        _last_unknown_kid = kid
        _last_unknown_kid_ts = now
        _jwks = _fetch_jwks()
        _jwks_ts = now
        key = _find_key_in_jwks(_jwks, kid)
        if key:
            return key

    return None


def _find_key_in_jwks(jwks: dict, kid: str | None):
    if not jwks:
        return None
    for jwk in jwks.get("keys", []):
        if jwk.get("kid") == kid:
            return _jwk_to_key(jwk)
    return None


def _jwk_to_key(jwk: dict):
    """Конвертирует JWK RSA public key в объект cryptography."""
    n_bytes = _b64url_decode(jwk["n"])
    e_bytes = _b64url_decode(str(jwk["e"]))
    n_int = int.from_bytes(n_bytes, "big")
    e_int = int.from_bytes(e_bytes, "big")
    pub_num = RSAPublicNumbers(e_int, n_int)
    return pub_num.public_key(default_backend())


def _b64url_decode(s: str) -> bytes:
    """Base64url decode с padding."""
    s += "=" * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s)


def verify_jwt(token: str) -> dict[str, Any]:
    """
    Проверяет JWT токен:
    - только RS256 (отклоняется ещё по заголовку)
    - ключ из JWKS по kid
    - exp (допуск 60 с)
    - iss == "radar-auth"
    - amr (массив) содержит "otp"
    Возвращает decoded payload или выбрасывает jwt.DecodeError / ExpiredSignatureError.
    """
    unverified = jwt.get_unverified_header(token)
    if unverified.get("alg") != "RS256":
        raise jwt.DecodeError("Unsupported algorithm")

    kid = unverified.get("kid")

    try:
        pub_key = _get_public_key(kid)
    except httpx.HTTPError:
        raise jwt.DecodeError("JWKS unavailable")

    if pub_key is None:
        raise jwt.DecodeError("Key not found")

    payload = jwt.decode(
        token,
        key=pub_key,
        algorithms=["RS256"],
        options={"verify_exp": False, "verify_aud": False},
        issuer="radar-auth",
    )

    now = time.time()
    exp = payload.get("exp", 0)
    if now > exp + 60:
        raise jwt.ExpiredSignatureError("Token expired")

    amr = payload.get("amr", [])
    if not isinstance(amr, list) or "otp" not in amr:
        raise jwt.DecodeError("Missing OTP authentication")

    return payload

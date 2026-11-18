"""Password hashing (stdlib scrypt) and JWT helpers (PyJWT).

Functions take secrets as arguments so they are trivially unit-testable;
``app.core.deps`` wires them to the real settings.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt

_N, _R, _P = 2**14, 8, 1
_DUMMY_HASH: str | None = None


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=_N, r=_R, p=_P, dklen=32)
    return f"scrypt${_N}${_R}${_P}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt_b64, hash_b64 = stored.split("$")
        if scheme != "scrypt":
            return False
        salt, expected = base64.b64decode(salt_b64), base64.b64decode(hash_b64)
        digest = hashlib.scrypt(
            password.encode(), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest, expected)


def burn_password_check(password: str) -> None:
    """Spend the same time as a real check so unknown usernames aren't distinguishable."""
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password(secrets.token_urlsafe(16))
    verify_password(password, _DUMMY_HASH)


def create_access_token(
    *, user_id: uuid.UUID, role: str, secret: str, algorithm: str, expires_minutes: int
) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,  # informational only; authorisation always re-reads the DB
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, secret, algorithm=algorithm), expires_minutes * 60


def decode_access_token(token: str, *, secret: str, algorithm: str) -> dict:
    """Raises jwt.PyJWTError on any invalid/expired token."""
    return jwt.decode(
        token, secret, algorithms=[algorithm], options={"require": ["sub", "exp", "iat"]}
    )

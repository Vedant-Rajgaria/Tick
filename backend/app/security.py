"""
Auth primitives: bcrypt password hashing + JWT access/refresh tokens.

Token design (stateless, MVP-appropriate):
  - Access tokens: short-lived (default 15 min), carry `sub` (user id) and
    `role`. Used on every protected request.
  - Refresh tokens: longer-lived (default 14 days), carry `sub` and a
    `type: refresh` claim so an access token can never be replayed as a
    refresh token or vice versa.

Known limitation (flagged deliberately, not hidden): refresh tokens are not
stored server-side, so there is no revocation list yet. A logout/rotate
endpoint plus a `refresh_tokens` table is the natural next step before this
goes anywhere near production — tracked as a TODO rather than solved here to
keep this phase scoped to the agent -> API -> DB pipeline.
"""
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt
from jwt import PyJWTError

from app.config import settings

TokenType = Literal["access", "refresh"]


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # password_hash isn't a valid bcrypt hash (e.g. a dev placeholder) —
        # treat as a failed login rather than raising.
        return False


def _create_token(user_id: int, role: str, token_type: TokenType, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int, role: str) -> str:
    return _create_token(
        user_id, role, "access", timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )


def create_refresh_token(user_id: int, role: str) -> str:
    return _create_token(
        user_id, role, "refresh", timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )


class TokenError(Exception):
    pass


def decode_token(token: str, expected_type: TokenType) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    if payload.get("type") != expected_type:
        raise TokenError(f"Expected a {expected_type} token, got {payload.get('type')}")

    return payload

"""FastAPI dependencies: current user, permission enforcement, pagination."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.rbac import Permission, has_permission
from app.core.security import decode_access_token
from app.enums import ActiveStatus
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False, description="Paste the access_token from POST /auth/login")


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    if creds is None:
        raise AuthenticationError("Missing bearer token")
    try:
        claims = decode_access_token(
            creds.credentials, secret=settings.jwt_secret_key, algorithm=settings.jwt_algorithm
        )
        user_id = uuid.UUID(claims["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise AuthenticationError("Invalid or expired token") from None
    # Role and status are always re-read from the DB, so demotion/deactivation is immediate.
    user = db.get(User, user_id)
    if user is None or user.status != ActiveStatus.ACTIVE:
        raise AuthenticationError("Account is inactive or no longer exists")
    return user


def require_permissions(*permissions: Permission):
    """Route dependency: 401 if not logged in, 403 if the role lacks ANY listed permission."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if not all(has_permission(user.role, p) for p in permissions):
            raise PermissionDeniedError(f"Role '{user.role.value}' is not allowed to perform this action")
        return user

    return checker


@dataclass(frozen=True)
class PageParams:
    limit: int
    offset: int


def page_params(
    limit: int = Query(50, ge=1, le=200, description="Page size"),
    offset: int = Query(0, ge=0, description="Rows to skip"),
) -> PageParams:
    return PageParams(limit=limit, offset=offset)

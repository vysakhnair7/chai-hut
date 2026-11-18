from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.deps import PageParams
from app.core.exceptions import AuthenticationError, BusinessRuleError, ConflictError
from app.core.security import (
    burn_password_check,
    create_access_token,
    hash_password,
    verify_password,
)
from app.enums import ActiveStatus, Role
from app.models import User
from app.schemas.auth_user import UserCreate, UserUpdate
from app.services.common import conflict_on_integrity, get_or_404, paginate

_BAD_LOGIN = "Invalid username or password"


def login(db: Session, settings: Settings, username: str, password: str) -> tuple[str, int]:
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        burn_password_check(password)  # same timing whether or not the user exists
        raise AuthenticationError(_BAD_LOGIN)
    if not verify_password(password, user.password_hash) or user.status != ActiveStatus.ACTIVE:
        raise AuthenticationError(_BAD_LOGIN)
    return create_access_token(
        user_id=user.id,
        role=user.role.value,
        secret=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        expires_minutes=settings.access_token_expire_minutes,
    )


def change_own_password(db: Session, user: User, current: str, new: str) -> None:
    if not verify_password(current, user.password_hash):
        raise AuthenticationError("Current password is incorrect")
    if current == new:
        raise BusinessRuleError("New password must differ from the current one")
    user.password_hash = hash_password(new)
    db.commit()


# ---------------- employee management (owner only, enforced in the router) ----------------
def _active_owner_count(db: Session) -> int:
    return db.scalar(
        select(func.count(User.id)).where(User.role == Role.OWNER, User.status == ActiveStatus.ACTIVE)
    ) or 0


def create_user(db: Session, data: UserCreate) -> User:
    if db.scalar(select(User.id).where(User.username == data.username)):
        raise ConflictError("Username already exists")
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        status=ActiveStatus.ACTIVE,
    )
    with conflict_on_integrity(db, "Username already exists"):
        db.add(user)
        db.commit()
    return user


def list_users(db: Session, params: PageParams, role: Role | None, status: ActiveStatus | None):
    stmt = select(User).order_by(User.created_at.desc(), User.id)
    if role:
        stmt = stmt.where(User.role == role)
    if status:
        stmt = stmt.where(User.status == status)
    return paginate(db, stmt, params)


def get_user(db: Session, user_id: uuid.UUID) -> User:
    return get_or_404(db, User, user_id, "User")


def update_user(db: Session, actor: User, user_id: uuid.UUID, data: UserUpdate) -> User:
    user = get_or_404(db, User, user_id, "User", lock=True)
    new_role = data.role or user.role
    new_status = data.status or user.status

    losing_owner = user.role == Role.OWNER and user.status == ActiveStatus.ACTIVE and (
        new_role != Role.OWNER or new_status != ActiveStatus.ACTIVE
    )
    if losing_owner and _active_owner_count(db) <= 1:
        raise BusinessRuleError("There must always be at least one active owner")
    if user.id == actor.id and new_status != ActiveStatus.ACTIVE:
        raise BusinessRuleError("You cannot deactivate your own account")

    if data.full_name is not None:
        user.full_name = data.full_name
    user.role, user.status = new_role, new_status
    db.commit()
    return user


def reset_password(db: Session, user_id: uuid.UUID, new_password: str) -> None:
    user = get_or_404(db, User, user_id, "User", lock=True)
    user.password_hash = hash_password(new_password)
    db.commit()

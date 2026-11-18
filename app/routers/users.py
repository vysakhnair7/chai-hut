from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import PageParams, page_params, require_permissions
from app.core.rbac import Permission
from app.enums import ActiveStatus, Role
from app.models import User
from app.routers.common import PROTECTED, make_page
from app.schemas.auth_user import PasswordReset, UserCreate, UserRead, UserUpdate
from app.schemas.common import Message, Page
from app.services import auth_service

router = APIRouter(
    prefix="/users",
    tags=["Employees"],
    responses=PROTECTED,
    dependencies=[Depends(require_permissions(Permission.USERS_MANAGE))],  # owner only
)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED, summary="Create employee")
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    return auth_service.create_user(db, body)


@router.get("", response_model=Page[UserRead], summary="List employees")
def list_users(
    role: Role | None = None,
    status: ActiveStatus | None = None,
    params: PageParams = Depends(page_params),
    db: Session = Depends(get_db),
):
    rows, total = auth_service.list_users(db, params, role, status)
    return make_page(rows, total, params)


@router.get("/{user_id}", response_model=UserRead, summary="Get employee")
def get_user(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return auth_service.get_user(db, user_id)


@router.patch("/{user_id}", response_model=UserRead, summary="Update name, role or status")
def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    actor: User = Depends(require_permissions(Permission.USERS_MANAGE)),
    db: Session = Depends(get_db),
):
    return auth_service.update_user(db, actor, user_id, body)


@router.post("/{user_id}/reset-password", response_model=Message, summary="Set a new password")
def reset_password(user_id: uuid.UUID, body: PasswordReset, db: Session = Depends(get_db)):
    auth_service.reset_password(db, user_id, body.new_password)
    return Message(detail="Password reset")

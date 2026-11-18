from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import User
from app.routers.common import PROTECTED
from app.schemas.auth_user import ChangePasswordRequest, LoginRequest, TokenResponse, UserRead
from app.schemas.common import ErrorResponse, Message
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Employee login",
    responses={401: {"model": ErrorResponse, "description": "Invalid username or password"}},
)
def login(body: LoginRequest, db: Session = Depends(get_db), settings: Settings = Depends(get_settings)):
    """Employees only (owner / manager / cashier). Customers never authenticate: staff look
    them up by username, phone or Chai ID."""
    token, expires_in = auth_service.login(db, settings, body.username, body.password)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=UserRead, summary="Current employee", responses=PROTECTED)
def me(user: User = Depends(get_current_user)):
    return user


@router.post(
    "/change-password", response_model=Message, summary="Change own password", responses=PROTECTED
)
def change_password(
    body: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    auth_service.change_own_password(db, user, body.current_password, body.new_password)
    return Message(detail="Password updated")

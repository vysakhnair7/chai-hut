"""Create the first owner account.  Usage:

    OWNER_USERNAME=... OWNER_PASSWORD=... python -m app.utils.bootstrap_owner

Credentials come from the environment (or .env), never from source code. Does nothing if
an active owner already exists, so it is safe to run on every container start.
"""
from __future__ import annotations

import os
import sys

from sqlalchemy import select

from app.core.config import _load_dotenv
from app.core.database import get_sessionmaker
from app.core.security import hash_password
from app.enums import ActiveStatus, Role
from app.models import User
from app.schemas.common import normalize_username, validate_password_strength


def bootstrap_owner(username: str, password: str, full_name: str) -> str:
    username = normalize_username(username)
    validate_password_strength(password)
    with get_sessionmaker()() as db:
        existing = db.scalar(
            select(User).where(User.role == Role.OWNER, User.status == ActiveStatus.ACTIVE).limit(1)
        )
        if existing:
            return f"An active owner already exists ('{existing.username}'); nothing to do."
        if db.scalar(select(User.id).where(User.username == username)):
            raise SystemExit(f"Username '{username}' is already taken by a non-owner account.")
        db.add(
            User(
                username=username, password_hash=hash_password(password), full_name=full_name,
                role=Role.OWNER, status=ActiveStatus.ACTIVE,
            )
        )
        db.commit()
    return f"Owner '{username}' created."


def main() -> None:
    _load_dotenv()
    username, password = os.environ.get("OWNER_USERNAME"), os.environ.get("OWNER_PASSWORD")
    if not username or not password:
        sys.exit("Set OWNER_USERNAME and OWNER_PASSWORD (environment or .env).")
    try:
        print(bootstrap_owner(username, password, os.environ.get("OWNER_FULL_NAME", "Chai Hut Owner")))
    except ValueError as exc:
        sys.exit(f"Invalid owner credentials: {exc}")


if __name__ == "__main__":
    main()

"""Environment-driven settings. No secrets or passwords live in source code.

Required: DATABASE_URL, JWT_SECRET_KEY (>= 32 chars). The app refuses to start without them.
A local ``.env`` file is read if present; real environment variables always win.
"""
from __future__ import annotations

import os
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field, ValidationError, field_validator


def _load_dotenv(path: str = ".env") -> None:
    p = Path(path)
    if not p.is_file():
        return
    for raw in p.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


class Settings(BaseModel):
    app_name: str = "Chai Hut API"
    environment: str = "development"

    database_url: str
    jwt_secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=60, ge=1, le=60 * 24)

    business_timezone: str = "Asia/Kolkata"
    default_gst_rate: Decimal = Decimal("5.00")
    manager_sales_window_days: int = Field(default=7, ge=1, le=366)
    cors_origins: list[str] = Field(default_factory=list)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v


_ENV_MAP = {
    "app_name": "APP_NAME",
    "environment": "ENVIRONMENT",
    "database_url": "DATABASE_URL",
    "jwt_secret_key": "JWT_SECRET_KEY",
    "jwt_algorithm": "JWT_ALGORITHM",
    "access_token_expire_minutes": "ACCESS_TOKEN_EXPIRE_MINUTES",
    "business_timezone": "BUSINESS_TIMEZONE",
    "default_gst_rate": "DEFAULT_GST_RATE",
    "manager_sales_window_days": "MANAGER_SALES_WINDOW_DAYS",
    "cors_origins": "CORS_ORIGINS",
}


def load_settings() -> Settings:
    _load_dotenv()
    values = {k: os.environ[env] for k, env in _ENV_MAP.items() if os.environ.get(env)}
    try:
        return Settings(**values)
    except ValidationError as exc:  # fail fast with a readable message
        missing = [".".join(map(str, e["loc"])) for e in exc.errors()]
        raise RuntimeError(
            f"Invalid or missing configuration: {', '.join(missing)}. See .env.example."
        ) from exc


@lru_cache
def get_settings() -> Settings:
    return load_settings()

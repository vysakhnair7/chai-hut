"""Chai Hut API entrypoint.  Run:  uvicorn app.main:app --reload"""
from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import register_exception_handlers
from app.routers import auth, catalog, credit, customers, expenses, orders, payments, reports, users

TAGS = [
    {"name": "Auth", "description": "Employee login (JWT bearer). Customers never log in."},
    {"name": "Employees", "description": "Owner only: employees and roles."},
    {"name": "Customers", "description": "Registration, Chai ID, company identification."},
    {"name": "Preferences", "description": "Regular drink and most-ordered products."},
    {"name": "Menu", "description": "Categories, products, prices and stock."},
    {"name": "Orders", "description": "Orders, tokens, status tracking and bills."},
    {"name": "Payments", "description": "Cash / UPI / card / corporate credit, idempotent."},
    {"name": "Corporate Credit", "description": "Dues, settlements and ledgers."},
    {"name": "Expenses", "description": "Daily expenditure."},
    {"name": "Reports & Analytics", "description": "Sales, P&L, trends."},
    {"name": "System", "description": "Health."},
]


def create_app() -> FastAPI:
    settings = get_settings()  # fails fast if DATABASE_URL / JWT_SECRET_KEY are missing
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=(
            "Backend for Chai Hut. Authenticate with `POST /auth/login`, then send "
            "`Authorization: Bearer <token>`. Every endpoint enforces role permissions "
            "(owner > manager > cashier) on the server."
        ),
        openapi_tags=TAGS,
    )
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["*"], allow_headers=["*"]
        )
    register_exception_handlers(app)
    for module in (auth, users, customers, catalog, orders, payments, credit, expenses, reports):
        app.include_router(module.router)

    @app.get("/health", tags=["System"], summary="Liveness + database check")
    def health(db: Session = Depends(get_db)):
        db.execute(text("SELECT 1"))
        return {"status": "ok"}

    return app


app = create_app()

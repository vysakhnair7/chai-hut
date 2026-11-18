"""Application errors and their HTTP mapping. Responses look like
``{"error": {"code": "...", "message": "..."}}`` so clients have one shape to handle."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("chai_hut")


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class NotFoundError(AppError):
    status_code, code = 404, "not_found"


class ConflictError(AppError):
    status_code, code = 409, "conflict"


class BusinessRuleError(AppError):
    status_code, code = 422, "business_rule_violation"


class AuthenticationError(AppError):
    status_code, code = 401, "authentication_failed"


class PermissionDeniedError(AppError):
    status_code, code = 403, "permission_denied"


def _body(code: str, message: str, extra: dict | None = None) -> dict:
    err = {"code": code, "message": message}
    if extra:
        err.update(extra)
    return {"error": err}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(_body(exc.code, exc.message), status_code=exc.status_code, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": e["msg"]}
            for e in exc.errors()
        ]
        return JSONResponse(
            _body("validation_error", "Request validation failed", {"details": details}),
            status_code=422,
        )

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(_body("internal_error", "Internal server error"), status_code=500)

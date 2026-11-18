FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run as an unprivileged user
RUN useradd --create-home --uid 10001 chai && chown -R chai /srv
USER chai

EXPOSE 8000

# Apply migrations, create the first owner from OWNER_USERNAME / OWNER_PASSWORD (no-op if one exists), then serve.
CMD ["sh", "-c", "alembic upgrade head && python -m app.utils.bootstrap_owner && uvicorn app.main:app --host 0.0.0.0 --port 8000"]

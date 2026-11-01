# One image: FastAPI serves the API and the React build on one domain (A26). Built from the
# repository root, since it needs both folders.

FROM node:24-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The commit, for the settings page; CI passes it (there's no .git in this context).
ARG GIT_SHA=""
RUN npm run build

FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.21 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Dependencies first, so code changes don't reinstall them.
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev

COPY backend/alembic.ini ./
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/scripts ./scripts
COPY --from=frontend /frontend/dist ./frontend
ENV FRONTEND_DIR=/app/frontend

RUN useradd --system --uid 10001 app
USER app

EXPOSE 8000
# Migrations and the cleanup job use this image with a different command (A11).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]

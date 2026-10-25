# Guestlist

A small web app for private events: hosts invite households through personal links, guests
answer without an account. See [docs/architecture.md](docs/architecture.md).

## Workflow

`main` is protected: every change goes through a pull request, CI must be green, and PRs are
squash-merged (decision P13). CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the
checks below and builds the backend image; merges to `main` push it to GHCR.

## Local development

Needs Docker and [uv](https://docs.astral.sh/uv/).

```sh
docker compose up --build            # Postgres, migrations, backend on http://localhost:8000
```

The admin API uses the dev bypass locally: every request is the same dev user, no login
(decision A13). API docs: http://localhost:8000/docs

### Backend without compose

```sh
docker compose up -d db
cd backend
cp .env.example .env
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

### Checks

Run from `backend/` with the database container up:

```sh
uv run ruff format --check . && uv run ruff check .
uv run pytest                                      # uses the guestlist_test database
uv run alembic check                               # models and migrations agree
uv run python -m scripts.export_openapi            # regenerate contract/openapi.json
```

### Changing the schema

Change the models in `backend/app/models/`, then:

```sh
uv run alembic revision --autogenerate -m "what changed"
```

Read the generated file before committing; autogenerate doesn't catch everything (e.g. renames).

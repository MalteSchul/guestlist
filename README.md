# Guestlist

A small web app for private events: hosts invite households through personal links, guests
answer without an account. See [docs/architecture.md](docs/architecture.md).

## Workflow

`main` is protected: every change goes through a pull request, CI must be green, and PRs are
squash-merged (decision P13). CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs the
checks below and builds both images; merges to `main` push them to GHCR.

## Local development

Needs Docker, [uv](https://docs.astral.sh/uv/) and Node 20.19+ (CI uses 24).

```sh
docker compose up --build    # Postgres, migrations, backend (:8000) and the nginx frontend (:8080)
```

Locally the admin API uses the dev bypass: every request is the same dev user, no login
(decision A13). Hosts set up events, questions and invites in the app at http://localhost:8080;
the API docs are at http://localhost:8000/docs

### Frontend with hot reload

```sh
cd frontend
npm install
npm run dev                  # http://localhost:5173, forwards /api to the backend on :8000
```

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

From `backend/`, with the database container up:

```sh
uv run ruff format --check . && uv run ruff check .
uv run pytest                                      # uses the guestlist_test database
uv run alembic check                               # models and migrations agree
uv run python -m scripts.export_openapi            # regenerate contract/openapi.json
```

From `frontend/`:

```sh
npm run generate-api                               # regenerate src/api/schema.d.ts from the contract
npm run typecheck && npm run build
```

### Changing the API

Change the schemas or routers, then regenerate both sides and commit them together:
`uv run python -m scripts.export_openapi` (backend) and `npm run generate-api` (frontend). CI fails
if either is out of date, and `tsc` fails if the frontend no longer fits the API.

### Changing the schema

Change the models in `backend/app/models/`, then:

```sh
uv run alembic revision --autogenerate -m "what changed"
```

Read the generated file before committing; autogenerate doesn't catch everything (e.g. renames).

# Working in this repo

## Git

- **Commit whenever a piece of work is finished**, without waiting to be asked. One commit per
  finished step, with a message that says what changed and why. Do not let finished work pile up
  uncommitted.
- Unrelated changes go into separate commits.
- `main` is protected: work happens on a branch and reaches `main` through a pull request
  (squash-merged). Open a PR or merge only when asked.
- Never skip hooks and never rewrite published history.

## Checks before committing

- Backend (`backend/`): `uv run ruff check .`, `uv run pytest`.
- Frontend (`frontend/`): `npx tsc --noEmit -p .`, `npm run build`.
- After changing API routes or schemas: `uv run python -m scripts.export_openapi` in `backend/`,
  then `npm run generate-api` in `frontend/`, and commit `contract/openapi.json` and
  `frontend/src/api/schema.d.ts` with the change.

## Conventions

- Texts live in `frontend/src/i18n/de.json` and `en.json`; change both together and remove keys
  that are no longer used.
- Vertical spacing on a page comes from two variables in `styles.css`: `--space-block` (12px,
  between neighbouring blocks and from a heading to its block) and `--space-section` (32px,
  above a section's heading). A card or list of cards directly in `main` gets its top gap from
  `main > * + .card` / `main > * + .cards`, whatever precedes it. Do not add new spacing
  numbers; use the variables, and for a new kind of block check the gap to its neighbours
  against the others on the same page.
- The UI prefers icons to text. Colours come from the CSS variables in `frontend/src/styles.css`.
- The dev database holds real data: look before deleting or overwriting, and ask first.

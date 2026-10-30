# Working in this repo

## Git

- Commit each finished step without being asked; the message says what changed and why.
  Unrelated changes go into separate commits.
- Other agents may work in this checkout at the same time. Their uncommitted changes are not
  yours: stage only the files (or hunks) you changed (`git add <path>` / `git add -p`, never
  `git add .` or `git commit -a`), check `git status` and `git diff --staged` before committing,
  and never revert, stash or reformat changes you did not make. If a file holds both your changes
  and someone else's, commit only your hunks.
- `main` is protected: work on a branch, reach `main` by PR (squash-merged). Open a PR or merge
  only when asked.
- Never skip hooks or rewrite published history.

## Checks before committing

- Backend (`backend/`): `uv run ruff check .`, `uv run pytest`.
- Frontend (`frontend/`): `npx tsc --noEmit -p .`, `npm run build`.
- After changing API routes or schemas: run `uv run python -m scripts.export_openapi` in
  `backend/`, then `npm run generate-api` in `frontend/`; commit `contract/openapi.json` and
  `frontend/src/api/schema.d.ts` with the change.

## Conventions

- Texts live in `frontend/src/i18n/de.json` and `en.json`: change both, remove unused keys.
- Vertical spacing uses only `--space-block` (12px; between blocks, heading to block) and
  `--space-section` (32px; above a section heading) from `styles.css`. No new spacing numbers;
  check a new kind of block against its neighbours on the same page.
- Prefer icons to text. Colours come from the CSS variables in `styles.css`.
- Hints: a tooltip when the hint only explains what a section is for (nice to know); inline text
  under the field when it says what happens if you choose an option (need to know before
  deciding, e.g. data deleted after 1 year). Touch screens have no hover, so a tooltip is easy
  to miss.
- The dev database holds real data: look before deleting or overwriting, and ask first.

# Decisions

Decisions made so far and why, newest at the bottom of each section. Change an entry by adding a
new one that replaces it, not by silently editing the old one.

## Platform

| # | Decision | Why |
|---|---|---|
| P1 | Containers + Docker are mandatory | Cloud-native setup, same image locally and in production |
| P2 | FastAPI + Pydantic backend | Validation and API docs come from the same models |
| P3 | React + Vite frontend (replaced Angular) | Preference. A guest page needs no server-side rendering, so no Next.js |
| P4 | PostgreSQL | Relational data with real constraints |
| P5 | Neon for production Postgres | Permanent free tier, managed, scales to zero. Frankfurt is close to Azure Germany West Central |
| P6 | Azure Container Apps | Already have an Azure account. Free monthly allowance, scales to zero, managed |
| P7 | GHCR as registry | Free. Azure Container Registry Basic costs about $5/month |
| P8 | GitHub Actions for CI/CD | Code lives on GitHub |
| P9 | One repository for frontend + backend | One pull request can change API and UI together, and the contract check runs in one place |
| P10 | Terraform for infrastructure | Widely used, works across clouds |
| P11 | uv, ruff, pytest | Fast, one lockfile, one lint/format tool |

## Architecture

| # | Decision | Why |
|---|---|---|
| A1 | nginx serves the React build and forwards `/api` | One domain, no CORS, one frontend image for every environment |
| A2 | Backend has internal ingress only | Smaller attack surface |
| A3 | SQLAlchemy 2 ORM + Alembic, sync | Most mature option. Sync is plenty at this scale |
| A4 | Pydantic schemas separate from SQLAlchemy models | The API contract never leaks database-only fields |
| A5 | Contract: openapi-typescript + openapi-fetch, generated files committed, CI drift check | Lightweight, and the contract can't drift. Contract changes are visible in pull requests |
| A6 | Rules: format in schemas, business rules in services, invariants in the database, frontend never enforces | Each rule has exactly one home |
| A7 | Entra External ID for hosts, provider-agnostic OIDC code | Free up to 50k monthly users, fits Azure. Switching providers means changing configuration |
| A8 | Guests use personal token links, no accounts | No friction for guests |
| A9 | Roles per event in our own database | Someone can be owner of one event and viewer of another, whatever the login provider |
| A10 | react-i18next from the start, DE + EN | Adding it later means hunting down every hard-coded string |
| A11 | Migrations and cleanup run as Container Apps Jobs from the backend image | No third image |
| A12 | Guest links: tokens from `secrets.token_urlsafe(32)`, `Referrer-Policy: no-referrer`, `/i/<token>` masked in access logs | The token is the only secret; URLs leak through referrers and logs |

## Data model

| # | Decision | Why |
|---|---|---|
| D1 | Questions and options are configured per event; drinks are just another question | Every event asks different things |
| D2 | Question kinds: `choice` (single/multiple) and `text` | Free text is needed, e.g. for allergies |
| D3 | All answers are private; only attendance can be made public (`attendance_public` per person + `guest_list_enabled` per event) | Privacy. Food choices can reveal health or religion |
| D4 | Attendance is a column (`pending/yes/no/maybe`), not a question | Counts and status depend on it, and every event needs it |
| D5 | "Maybe" exists and stays "maybe" after the deadline | Guests like it, and the host decides what to do with it |
| D6 | Admins create persons; guests can't add people | The host keeps control of the guest list |
| D7 | Invite tokens stored as-is | Admins can copy a link again at any time; a leak would only expose RSVP editing |
| D8 | Address book per user: contacts, groups, members (a contact can be in several groups) | Reuse guest lists across events |
| D9 | Inviting **copies** contacts into invites/persons, with `persons.contact_id` as the link back | History stays correct, private address book vs shared event, deleting in either place never breaks the other |
| D10 | Address book is never deleted automatically | It's the user's own data |
| D11 | Event data deleted 90 days after the event unless `keep_data` | Data minimisation (GDPR) |
| D12 | Answer window: until `rsvp_deadline` if set (may be after the start), otherwise until `starts_at` | Simple and predictable |
| D13 | Optional `ends_at` | Multi-day events; retention counts from the end |
| D14 | Several owners per event allowed; the app never removes the last owner | Simpler than a single-owner rule |
| D15 | Emails unique regardless of case (`lower(email)` index) | Cheap invariant, so it belongs in the database |
| D16 | JSONB `{"de","en"}` only for text guests see; `location` stays plain text | Addresses don't get translated; maps link and calendar invite |
| D17 | Extra info as `event_sections` | Structured and orderable, without columns for every possible topic |
| D18 | No adult/child concept for now; `contacts.birth_year` kept as a plain field | Too specific to start with |
| D19 | No `invites.responded_at` | Guests answer step by step. "Answered" comes from `persons.attendance`, "when" from `updated_at` |
| D20 | Every table has `created_at` + `updated_at` | One rule, no exceptions |
| D21 | "A contact is invited at most once per event" lives in the service layer, not the database | A database rule would need a redundant `persons.event_id`, and the app check is needed anyway for a friendly message. Can be added later with one migration |
| D22 | Allowed values as text + CHECK, not native Postgres enums | Easier to change in migrations |
| D23 | `persons.attendance_changed_at`, set by the service on every attendance change (replaces the "when" part of D19) | `updated_at` also moves when an admin renames or reorders a person. Answer times are already in `person_answers.updated_at` |

## Open

- **Household vs. circle-of-friends groups:** does inviting a group create one shared link or one
  link per member? A flag on the group, or a choice when inviting?
- **Do "maybe" guests answer the questions?**
- **`invites.last_opened_at`** ("has the guest seen it?"): later.
- **CSV export/import of contacts** (contacts table only): later feature.
- **Local auth:** Entra test tenant or a dev bypass.
- **Slimmer platform (proposal, not decided):** one image (FastAPI serves the React build, no
  nginx, no internal ingress; `Referrer-Policy` moves to middleware), migrations run from GitHub
  Actions before deploy, cleanup stays a Container Apps Job (GitHub disables scheduled workflows
  after 60 days of inactivity), one `az` CLI script instead of Terraform + bootstrap. Would replace
  P10, A1, A2, A11.
- **Image visibility on GHCR** (public or private + pull token), **Neon via Terraform or by hand**,
  **domain name**.

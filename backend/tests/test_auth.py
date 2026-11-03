from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import dependencies, google
from app.config import Settings
from app.models import Identity, LoginSession, User
from app.routers import auth
from app.services import login_sessions
from app.services.users import get_or_create_user_for_login

CLIENT_ID = "guestlist.apps.googleusercontent.com"
CALLBACK = "http://testserver/api/auth/google/callback"
NINETY_DAYS = "Max-Age=7776000"

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def make_id_token(**overrides) -> str:
    claims = {
        "iss": google.ISSUER,
        "aud": CLIENT_ID,
        "sub": "google-subject-1",
        "exp": datetime.now(UTC) + timedelta(minutes=5),
        "email": "host@example.com",
        "email_verified": True,
        "name": "Host",
    } | overrides
    return jwt.encode(claims, _private_key, algorithm="RS256")


@pytest.fixture
def google_login(monkeypatch):
    """The real login instead of the dev bypass, with "Google" signing with a local key. Set
    `next_token` to the ID token it hands out for the next code; `exchanged` lists the swaps."""
    settings = Settings(
        _env_file=None,
        environment="local",
        database_url="postgresql+psycopg://unused@localhost/unused",
        auth_dev_bypass=False,
        google_client_id=CLIENT_ID,
        google_client_secret="secret",
    )
    for module in (dependencies, auth, google):
        monkeypatch.setattr(module, "get_settings", lambda: settings)
    signing_key = SimpleNamespace(key=_private_key.public_key())
    jwks = SimpleNamespace(get_signing_key_from_jwt=lambda token: signing_key)
    monkeypatch.setattr(google, "_jwks_client", lambda: jwks)

    fake = SimpleNamespace(next_token=make_id_token(), exchanged=[])

    def exchange(code, verifier, redirect_uri):
        fake.exchanged.append((code, verifier, redirect_uri))
        return google.validate_id_token(fake.next_token)

    monkeypatch.setattr(google, "exchange_code", exchange)
    return fake


def start_login(client: TestClient, to: str = "/admin/events/1") -> str:
    """Off to Google; returns the state Google sends back."""
    response = client.get("/api/auth/google", params={"to": to}, follow_redirects=False)
    assert response.status_code == 307
    query = parse_qs(urlsplit(response.headers["location"]).query)
    assert query["client_id"] == [CLIENT_ID]
    assert query["code_challenge_method"] == ["S256"]
    assert query["redirect_uri"] == [CALLBACK]
    return query["state"][0]


def come_back(client: TestClient, **params):
    return client.get("/api/auth/google/callback", params=params, follow_redirects=False)


def log_in(client: TestClient, to: str = "/admin/events/1"):
    return come_back(client, code="code-1", state=start_login(client, to))


def get_me(client: TestClient):
    return client.get("/api/admin/me")


def count(session: Session, model) -> int:
    return session.scalar(select(func.count()).select_from(model))


def test_dev_bypass_logs_in_the_same_dev_user_every_time(client: TestClient, session: Session):
    first = get_me(client)
    second = get_me(client)
    assert first.status_code == 200
    assert first.json() == second.json()
    assert first.json()["email"] == dependencies.DEV_EMAIL
    assert count(session, Identity) == 1


def test_not_logged_in(client: TestClient, google_login):
    assert get_me(client).status_code == 401


def test_login_and_back_to_the_page(client: TestClient, google_login):
    response = log_in(client, "/admin/events/1?tab=guests")
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/events/1?tab=guests"
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie and NINETY_DAYS in cookie
    assert get_me(client).json()["email"] == "host@example.com"


def test_the_code_is_swapped_with_the_logins_verifier(
    client: TestClient, google_login, session: Session
):
    log_in(client)
    code, verifier, redirect_uri = google_login.exchanged[0]
    assert (code, redirect_uri) == ("code-1", CALLBACK)
    assert verifier
    identity = session.scalars(select(Identity)).one()
    assert (identity.issuer, identity.subject) == (google.ISSUER, "google-subject-1")


def test_only_the_session_tokens_hash_is_stored(client: TestClient, google_login, session: Session):
    log_in(client)
    stored = session.scalars(select(LoginSession)).one()
    assert client.cookies["session"] not in stored.token_hash


def test_a_state_from_another_browser_is_refused(client: TestClient, google_login):
    start_login(client)
    response = come_back(client, code="code-1", state="someone-elses-state")
    assert response.headers["location"] == "/admin/events/1?login=failed"
    assert google_login.exchanged == []
    assert get_me(client).status_code == 401


def test_cancelled_at_google(client: TestClient, google_login):
    response = come_back(client, error="access_denied", state=start_login(client))
    assert response.headers["location"] == "/admin/events/1?login=failed"


@pytest.mark.parametrize(
    "token",
    [
        make_id_token(aud="someone-else"),
        make_id_token(iss="https://evil.example"),
        make_id_token(exp=datetime.now(UTC) - timedelta(minutes=1)),
        make_id_token(email_verified=False),
        make_id_token(email=None),
    ],
    ids=["audience", "issuer", "expired", "unverified-email", "no-email"],
)
def test_rejected_id_tokens(client: TestClient, google_login, token):
    google_login.next_token = token
    assert log_in(client).headers["location"] == "/admin/events/1?login=failed"
    assert get_me(client).status_code == 401


@pytest.mark.parametrize("to", ["https://evil.example", "//evil.example", "/\\evil.example"])
def test_never_back_to_another_site(client: TestClient, google_login, to):
    assert log_in(client, to).headers["location"] == "/"


def test_logout_ends_the_session(client: TestClient, google_login, session: Session):
    log_in(client)
    token = client.cookies["session"]
    assert client.post("/api/auth/logout").status_code == 204
    assert count(session, LoginSession) == 0
    client.cookies.set("session", token)  # a copy of the cookie doesn't work either
    assert get_me(client).status_code == 401


def test_an_old_session_has_run_out(client: TestClient, google_login, session: Session):
    log_in(client)
    session.scalars(select(LoginSession)).one().expires_at = datetime.now(UTC)
    session.flush()
    assert get_me(client).status_code == 401


def test_a_session_in_use_is_extended(client: TestClient, google_login, session: Session):
    log_in(client)
    stored = session.scalars(select(LoginSession)).one()
    stored.expires_at = datetime.now(UTC) + timedelta(days=30)
    session.flush()
    assert NINETY_DAYS in get_me(client).headers["set-cookie"]
    assert stored.expires_at > datetime.now(UTC) + login_sessions.LIFETIME - timedelta(minutes=1)
    # Not again on the same day.
    assert "set-cookie" not in get_me(client).headers


def test_new_login_with_known_email_joins_existing_user(session: Session):
    user = get_or_create_user_for_login(
        session, issuer="a", subject="1", email="Host@Example.com", display_name="Host"
    )
    same = get_or_create_user_for_login(
        session, issuer="b", subject="2", email="host@example.com", display_name="Host"
    )
    assert same.id == user.id
    assert count(session, User) == 1
    assert count(session, Identity) == 2


def test_the_frontend_learns_whether_to_log_in(client: TestClient, google_login):
    assert client.get("/api/auth/config").json() == {"mode": "google"}


def test_no_login_with_the_dev_bypass(client: TestClient):
    assert client.get("/api/auth/config").json() == {"mode": "dev"}

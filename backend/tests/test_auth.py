from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import dependencies, tokens
from app.config import Settings
from app.models import Identity, User
from app.services.users import get_or_create_user_for_login

ISSUER = "https://issuer.example/v2.0"
AUDIENCE = "api://guestlist"
SCOPE = "guestlist.admin"

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def make_token(**overrides) -> str:
    claims = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": "entra-subject-1",
        "exp": datetime.now(UTC) + timedelta(minutes=5),
        "scp": SCOPE,
        "email": "host@example.com",
        "name": "Host",
    } | overrides
    return jwt.encode(claims, _private_key, algorithm="RS256")


@pytest.fixture
def oidc(monkeypatch):
    """Real token validation against a local key instead of the dev bypass."""
    settings = Settings(
        _env_file=None,
        environment="production",
        database_url="postgresql+psycopg://unused@localhost/unused",
        auth_dev_bypass=False,
        oidc_issuer=ISSUER,
        oidc_audience=AUDIENCE,
        oidc_jwks_url="https://issuer.example/keys",
        oidc_required_scope=SCOPE,
    )
    monkeypatch.setattr(dependencies, "get_settings", lambda: settings)
    monkeypatch.setattr(tokens, "get_settings", lambda: settings)
    signing_key = SimpleNamespace(key=_private_key.public_key())
    jwks = SimpleNamespace(get_signing_key_from_jwt=lambda token: signing_key)
    monkeypatch.setattr(tokens, "_jwks_client", lambda: jwks)


def get_me(client: TestClient, token: str | None = None):
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return client.get("/api/admin/me", headers=headers)


def test_dev_bypass_logs_in_the_same_dev_user_every_time(client: TestClient, session: Session):
    first = get_me(client)
    second = get_me(client)
    assert first.status_code == 200
    assert first.json() == second.json()
    assert first.json()["email"] == dependencies.DEV_EMAIL
    assert session.scalar(select(func.count()).select_from(Identity)) == 1


def test_valid_token(client: TestClient, oidc):
    response = get_me(client, make_token())
    assert response.status_code == 200
    assert response.json()["email"] == "host@example.com"


@pytest.mark.parametrize(
    "token",
    [
        None,
        "not-a-jwt",
        make_token(aud="api://someone-else"),
        make_token(iss="https://evil.example"),
        make_token(exp=datetime.now(UTC) - timedelta(minutes=1)),
        make_token(scp="other.scope"),
        make_token(email=None),
    ],
    ids=["missing", "garbage", "audience", "issuer", "expired", "scope", "no-email"],
)
def test_rejected_tokens(client: TestClient, oidc, token):
    assert get_me(client, token).status_code == 401


def test_new_login_with_known_email_joins_existing_user(session: Session):
    user = get_or_create_user_for_login(
        session, issuer="a", subject="1", email="Host@Example.com", display_name="Host"
    )
    same = get_or_create_user_for_login(
        session, issuer="b", subject="2", email="host@example.com", display_name="Host"
    )
    assert same.id == user.id
    assert session.scalar(select(func.count()).select_from(User)) == 1
    assert session.scalar(select(func.count()).select_from(Identity)) == 2

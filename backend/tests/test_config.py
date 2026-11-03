import pytest
from pydantic import ValidationError

from app.config import Settings

OIDC = {
    "oidc_issuer": "https://issuer.example/v2.0",
    "oidc_audience": "api://guestlist",
    "oidc_jwks_url": "https://issuer.example/keys",
    "oidc_authority": "https://login.example/tenant/v2.0",
    "oidc_client_id": "web-app",
    "oidc_client_scope": "api://guestlist/access",
}


def make(**values) -> Settings:
    # Explicit values win over the test environment (conftest turns the bypass on).
    values.setdefault("auth_dev_bypass", False)
    return Settings(_env_file=None, database_url="postgresql+psycopg://x@localhost/x", **values)


def test_dev_bypass_allowed_locally():
    assert make(environment="local", auth_dev_bypass=True).auth_dev_bypass


def test_dev_bypass_refused_in_production():
    with pytest.raises(ValidationError, match="only allowed with ENVIRONMENT=local"):
        make(environment="production", auth_dev_bypass=True, **OIDC)


def test_oidc_required_without_bypass():
    with pytest.raises(ValidationError, match="OIDC_ISSUER"):
        make(environment="production")
    make(environment="production", **OIDC)


def test_the_frontend_settings_are_required_too():
    """The page can't log anyone in without them, so the app shouldn't start."""
    without_client = {k: v for k, v in OIDC.items() if k != "oidc_client_id"}
    with pytest.raises(ValidationError, match="OIDC_CLIENT_ID"):
        make(environment="production", **without_client)

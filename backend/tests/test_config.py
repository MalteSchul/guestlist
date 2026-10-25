import pytest
from pydantic import ValidationError

from app.config import Settings

OIDC = {
    "oidc_issuer": "https://issuer.example/v2.0",
    "oidc_audience": "api://guestlist",
    "oidc_jwks_url": "https://issuer.example/keys",
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

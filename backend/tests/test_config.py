import pytest
from pydantic import ValidationError

from app.config import Settings

GOOGLE = {"google_client_id": "guestlist.apps.googleusercontent.com", "google_client_secret": "s"}


def make(**values) -> Settings:
    # Explicit values win over the test environment (conftest turns the bypass on).
    values.setdefault("auth_dev_bypass", False)
    return Settings(_env_file=None, database_url="postgresql+psycopg://x@localhost/x", **values)


def test_dev_bypass_allowed_locally():
    assert make(environment="local", auth_dev_bypass=True).auth_dev_bypass


def test_dev_bypass_refused_in_production():
    with pytest.raises(ValidationError, match="only allowed with ENVIRONMENT=local"):
        make(environment="production", auth_dev_bypass=True, **GOOGLE)


def test_google_required_without_bypass():
    with pytest.raises(ValidationError, match="GOOGLE_CLIENT_ID"):
        make(environment="production")
    with pytest.raises(ValidationError, match="GOOGLE_CLIENT_SECRET"):
        make(environment="production", google_client_id=GOOGLE["google_client_id"])
    make(environment="production", **GOOGLE)

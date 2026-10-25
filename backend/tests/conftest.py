import os

# Settings are read on first import of the app, so set them before anything else.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://guestlist:guestlist@localhost:5432/guestlist_test",
)
os.environ.update(ENVIRONMENT="local", DATABASE_URL=TEST_DATABASE_URL, AUTH_DEV_BYPASS="true")

import uuid  # noqa: E402
from collections.abc import Callable, Iterator  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Connection, create_engine, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.auth.dependencies import current_user  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models import EventRole, User  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    return Config(BACKEND_DIR / "alembic.ini")


@pytest.fixture(scope="session")
def engine(alembic_config: Config):
    """Test database at the latest migration. Starts from an empty schema on every run."""
    engine = create_engine(TEST_DATABASE_URL)
    with engine.begin() as connection:
        connection.execute(text("DROP SCHEMA public CASCADE"))
        connection.execute(text("CREATE SCHEMA public"))
    command.upgrade(alembic_config, "head")
    yield engine
    engine.dispose()


@pytest.fixture
def connection(engine) -> Iterator[Connection]:
    with engine.connect() as connection:
        transaction = connection.begin()
        yield connection
        transaction.rollback()


@pytest.fixture
def session(connection: Connection) -> Iterator[Session]:
    """Every test runs in a transaction that is rolled back; service commits become savepoints."""
    with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
        yield session


@pytest.fixture
def client(session: Session) -> Iterator[TestClient]:
    """Logged in as the dev user (dev bypass)."""
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def log_in_as(session: Session, client: TestClient) -> Callable[..., User]:
    """Switch the client to a new user, optionally with a role on an event."""

    def switch(email: str, event_id: str | None = None, role: str | None = None) -> User:
        user = User(email=email, display_name=email)
        session.add(user)
        session.flush()
        if event_id and role:
            session.add(EventRole(event_id=uuid.UUID(event_id), user_id=user.id, role=role))
            session.flush()
        app.dependency_overrides[current_user] = lambda: user
        return user

    return switch

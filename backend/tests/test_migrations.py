from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext

from app.models import Base


def test_models_match_migrations(engine):
    """A model change without a migration fails here (and `alembic check` fails in CI)."""
    with engine.connect() as connection:
        context = MigrationContext.configure(
            connection, opts={"compare_type": True, "compare_server_default": True}
        )
        assert compare_metadata(context, Base.metadata) == []


def test_downgrade_and_upgrade_again(engine, alembic_config: Config):
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")

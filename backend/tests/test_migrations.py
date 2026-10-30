from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import text

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


def test_sections_are_folded_into_the_description(engine, alembic_config: Config):
    """D35: each section is appended to its event's description, in order, title above body."""
    command.downgrade(alembic_config, "6375ab642939")
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO events (id, title, description, starts_at) VALUES"
                " ('00000000-0000-0000-0000-000000000001', 'Fest', 'Kommt alle!', now()),"
                " ('00000000-0000-0000-0000-000000000002', 'Ohne Text', NULL, now()),"
                " ('00000000-0000-0000-0000-000000000003', 'Ohne Infos', 'Nur Text', now())"
            )
        )
        connection.execute(
            text(
                "INSERT INTO event_sections (id, event_id, title, body, position) VALUES"
                " (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Kleidung',"
                "  'Warm', 1),"
                " (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'Parken',"
                "  'Im Hof', 0),"
                " (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'Parken',"
                "  'Im Hof', 0)"
            )
        )
    command.upgrade(alembic_config, "head")
    with engine.begin() as connection:
        ours = "id::text LIKE '00000000-0000-0000-0000-00000000000_'"
        rows = connection.execute(
            text(f"SELECT title, description FROM events WHERE {ours} ORDER BY id")
        ).all()
        connection.execute(text(f"DELETE FROM events WHERE {ours}"))
    assert [tuple(row) for row in rows] == [
        ("Fest", "Kommt alle!\n\nParken\nIm Hof\n\nKleidung\nWarm"),
        ("Ohne Text", "Parken\nIm Hof"),
        ("Ohne Infos", "Nur Text"),
    ]

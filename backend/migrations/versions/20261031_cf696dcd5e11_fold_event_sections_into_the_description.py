"""fold event sections into the description

Revision ID: cf696dcd5e11
Revises: 6375ab642939
Create Date: 2026-10-31 00:45:43.588282

Extra info lives in the description now (D35). Each section is appended to its event's
description, its title on one line and its body under it, sections apart by a blank line and in
their order; then the table goes. Going back recreates the empty table: the text stays in the
description.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "cf696dcd5e11"
down_revision: str | Sequence[str] | None = "6375ab642939"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        UPDATE events AS e
        SET description = concat_ws(E'\\n\\n', e.description, s.info), updated_at = now()
        FROM (
            SELECT event_id,
                   string_agg(title || E'\\n' || body, E'\\n\\n' ORDER BY position, created_at)
                       AS info
            FROM event_sections
            GROUP BY event_id
        ) AS s
        WHERE s.event_id = e.id
        """
    )
    op.drop_index(op.f("ix_event_sections_event_id"), table_name="event_sections")
    op.drop_table("event_sections")


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table(
        "event_sections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["event_id"],
            ["events.id"],
            name=op.f("fk_event_sections_event_id_events"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_event_sections")),
    )
    op.create_index(
        op.f("ix_event_sections_event_id"), "event_sections", ["event_id"], unique=False
    )

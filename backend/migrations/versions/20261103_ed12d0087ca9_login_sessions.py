"""login sessions

Revision ID: ed12d0087ca9
Revises: 5b1d0e7a9c42
Create Date: 2026-11-03 12:00:00.000000

Hosts log in with Google and then stay logged in through a session cookie of our own (A28):
one row per logged-in browser, holding the hash of the cookie's token.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "ed12d0087ca9"
down_revision: str | Sequence[str] | None = "5b1d0e7a9c42"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "login_sessions",
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
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
            ["user_id"],
            ["users.id"],
            name=op.f("fk_login_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("token_hash", name=op.f("pk_login_sessions")),
    )
    op.create_index(
        op.f("ix_login_sessions_expires_at"), "login_sessions", ["expires_at"], unique=False
    )
    op.create_index(op.f("ix_login_sessions_user_id"), "login_sessions", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_login_sessions_user_id"), table_name="login_sessions")
    op.drop_index(op.f("ix_login_sessions_expires_at"), table_name="login_sessions")
    op.drop_table("login_sessions")

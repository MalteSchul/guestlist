"""open signup link

Revision ID: 5b1d0e7a9c42
Revises: cf696dcd5e11
Create Date: 2026-11-01 12:00:00.000000

An event may have one open link everyone can sign up with (D36): `events.signup_token`, empty
while the host hasn't turned it on. Invites made through it are marked `self_registered`; all
existing invites were made by hosts.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5b1d0e7a9c42"
down_revision: str | Sequence[str] | None = "cf696dcd5e11"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("events", sa.Column("signup_token", sa.Text(), nullable=True))
    op.create_unique_constraint(op.f("uq_events_signup_token"), "events", ["signup_token"])
    op.add_column(
        "invites",
        sa.Column("self_registered", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("invites", "self_registered")
    op.drop_constraint(op.f("uq_events_signup_token"), "events", type_="unique")
    op.drop_column("events", "signup_token")

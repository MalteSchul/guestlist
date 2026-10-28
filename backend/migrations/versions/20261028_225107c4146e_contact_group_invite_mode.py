"""contact group invite mode

Revision ID: 225107c4146e
Revises: 73b7a1108d4e
Create Date: 2026-10-28 17:18:15.971216

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "225107c4146e"
down_revision: str | Sequence[str] | None = "73b7a1108d4e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "contact_groups",
        sa.Column("invite_mode", sa.Text(), server_default=sa.text("'together'"), nullable=False),
    )
    # Autogenerate doesn't see CHECK constraints (D22).
    op.create_check_constraint(
        op.f("ck_contact_groups_invite_mode"),
        "contact_groups",
        "invite_mode IN ('together', 'separately')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("ck_contact_groups_invite_mode"), "contact_groups", type_="check")
    op.drop_column("contact_groups", "invite_mode")

import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Annotated, Any

from sqlalchemy import CheckConstraint, DateTime, MetaData, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Fixed constraint names, so Alembic migrations are predictable (see data-model.md).
NAMING_CONVENTION = {
    "pk": "pk_%(table_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "ix": "ix_%(column_0_label)s",
}

UuidPk = Annotated[uuid.UUID, mapped_column(primary_key=True, default=uuid.uuid4)]


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {
        str: Text,
        datetime: DateTime(timezone=True),
    }


class Timestamps:
    """created_at + updated_at on every table (D20)."""

    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), sort_order=100)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), sort_order=100
    )


def check_in(column: str, values: tuple[str, ...]) -> CheckConstraint:
    """Allowed values as text + CHECK instead of a Postgres enum (D22)."""
    allowed = ", ".join(f"'{v}'" for v in values)
    return CheckConstraint(f"{column} IN ({allowed})", name=column)


def owned_children(order_by: Callable[[], list[Any]]) -> Any:
    """A parent's ordered children. They're deleted with the parent: by Postgres (ON DELETE
    CASCADE) when not loaded, by the ORM when they are, and when removed from the list."""
    return relationship(
        order_by=order_by, cascade="all, delete-orphan", passive_deletes=True, lazy="selectin"
    )

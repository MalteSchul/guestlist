"""1. Who manages: people who log in and what they may do. Guests never appear here."""

import uuid
from typing import Literal, get_args

from sqlalchemy import ForeignKey, Index, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UuidPk, check_in

Role = Literal["owner", "admin", "viewer"]


class User(Timestamps, Base):
    __tablename__ = "users"

    id: Mapped[UuidPk]
    email: Mapped[str]
    display_name: Mapped[str]


# Emails are unique regardless of case (D15).
Index("uq_users_lower_email", func.lower(User.email), unique=True)


class Identity(Timestamps, Base):
    """'This login provider account is that user.'"""

    __tablename__ = "identities"

    id: Mapped[UuidPk]
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    issuer: Mapped[str]
    subject: Mapped[str]

    __table_args__ = (UniqueConstraint("issuer", "subject"),)


class EventRole(Timestamps, Base):
    __tablename__ = "event_roles"

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    role: Mapped[str]

    __table_args__ = (check_in("role", get_args(Role)),)

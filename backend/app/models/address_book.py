"""2. Address book: each user's own people and groups, reused across events, kept forever."""

import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UuidPk


class Contact(Timestamps, Base):
    __tablename__ = "contacts"

    id: Mapped[UuidPk]
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str]
    birth_year: Mapped[int | None]


class ContactGroup(Timestamps, Base):
    __tablename__ = "contact_groups"

    id: Mapped[UuidPk]
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str]


class ContactGroupMember(Timestamps, Base):
    __tablename__ = "contact_group_members"

    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contact_groups.id", ondelete="CASCADE"), primary_key=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    position: Mapped[int]

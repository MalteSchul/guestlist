"""2. Address book: each user's own people and groups, reused across events, kept forever."""

import uuid
from typing import Literal, get_args

from sqlalchemy import ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UuidPk, check_in, owned_children

# What inviting a group creates by default: one shared link (a household) or one link per
# member (a circle of friends). The host can still choose the other when inviting (D31).
InviteMode = Literal["together", "separately"]


class Contact(Timestamps, Base):
    __tablename__ = "contacts"

    id: Mapped[UuidPk]
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str]
    birth_year: Mapped[int | None]

    # Read-only: memberships are changed through the group's `members`.
    memberships: Mapped[list["ContactGroupMember"]] = relationship(lazy="selectin", viewonly=True)

    @property
    def group_ids(self) -> list[uuid.UUID]:
        return [membership.group_id for membership in self.memberships]


class ContactGroup(Timestamps, Base):
    __tablename__ = "contact_groups"

    id: Mapped[UuidPk]
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str]
    invite_mode: Mapped[str] = mapped_column(server_default=text("'together'"))

    members: Mapped[list["ContactGroupMember"]] = owned_children(
        lambda: [ContactGroupMember.position, ContactGroupMember.created_at]
    )

    __table_args__ = (check_in("invite_mode", get_args(InviteMode)),)

    @property
    def member_ids(self) -> list[uuid.UUID]:
        return [member.contact_id for member in self.members]


class ContactGroupMember(Timestamps, Base):
    __tablename__ = "contact_group_members"

    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contact_groups.id", ondelete="CASCADE"), primary_key=True
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    position: Mapped[int]

    contact: Mapped[Contact] = relationship(lazy="selectin", viewonly=True)

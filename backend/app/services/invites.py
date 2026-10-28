"""Invites as hosts see them: who is invited, and what they answered."""

import secrets
import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Contact, Invite, Person, User
from app.schemas.invites import GroupInviteIn, InviteIn
from app.services.access import require_role
from app.services.address_book import own_contacts, own_groups
from app.services.errors import Conflict, Invalid, NotFound

# Base58: no 0/O/I/l look-alikes and no "-", so a double-click selects the whole token.
TOKEN_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def new_token() -> str:
    """The secret in a guest link: 44 base58 characters, 58^44 > 2^256 (A12)."""
    return "".join(secrets.choice(TOKEN_ALPHABET) for _ in range(44))


def list_invites(session: Session, user: User, event_id: uuid.UUID) -> Sequence[Invite]:
    require_role(session, user, event_id, "viewer")
    return session.scalars(
        select(Invite).where(Invite.event_id == event_id).order_by(Invite.created_at)
    ).all()


def create_invite(session: Session, user: User, event_id: uuid.UUID, data: InviteIn) -> Invite:
    """One personal link for the given people: typed-in names, or contacts from the host's
    own address book, copied in (D9). A contact is invited at most once per event (D21)."""
    require_role(session, user, event_id, "admin")
    contact_ids = [person.contact_id for person in data.persons if person.contact_id]
    if len(set(contact_ids)) < len(contact_ids):
        raise Invalid("a contact can only be in an invite once")
    contacts = own_contacts(session, user, contact_ids)
    already = _invited(session, event_id) & {contact.id for contact in contacts}
    if already:
        names = ", ".join(contact.name for contact in contacts if contact.id in already)
        raise Conflict(f"already invited: {names}")
    invite = Invite(
        event_id=event_id,
        name=data.name,
        token=new_token(),
        persons=[
            Person(name=person.name, contact_id=person.contact_id, position=i)
            for i, person in enumerate(data.persons)
        ],
    )
    session.add(invite)
    session.commit()
    return invite


@dataclass
class GroupInvites:
    invites: list[Invite]
    skipped: list[str]


def invite_group(
    session: Session, user: User, event_id: uuid.UUID, data: GroupInviteIn
) -> GroupInvites:
    """A group from the host's address book: one shared link for all, or one per member, as the
    host chose or the group says (D31). Members already invited are skipped (D21)."""
    require_role(session, user, event_id, "admin")
    [group] = own_groups(session, user, [data.group_id])
    contacts = [member.contact for member in group.members]
    if not contacts:
        raise Invalid("this group has no members")
    already = _invited(session, event_id)
    new = [contact for contact in contacts if contact.id not in already]
    if not new:
        raise Conflict("everyone in this group is already invited")

    def invite(name: str, members: list[Contact]) -> Invite:
        persons = [
            Person(name=contact.name, contact_id=contact.id, position=i)
            for i, contact in enumerate(members)
        ]
        return Invite(event_id=event_id, name=name, token=new_token(), persons=persons)

    if (data.invite_mode or group.invite_mode) == "together":
        invites = [invite(group.name, new)]
    else:
        invites = [invite(contact.name, [contact]) for contact in new]
    session.add_all(invites)
    session.commit()
    skipped = [contact.name for contact in contacts if contact.id in already]
    return GroupInvites(invites=invites, skipped=skipped)


def _invited(session: Session, event_id: uuid.UUID) -> set[uuid.UUID]:
    """The contacts that already have a person in this event."""
    return set(
        session.scalars(
            select(Person.contact_id)
            .join(Invite)
            .where(Invite.event_id == event_id, Person.contact_id.is_not(None))
        )
    )


def delete_invite(session: Session, user: User, event_id: uuid.UUID, invite_id: uuid.UUID) -> None:
    require_role(session, user, event_id, "admin")
    invite = session.scalar(
        select(Invite).where(Invite.id == invite_id, Invite.event_id == event_id)
    )
    if invite is None:
        raise NotFound("invite not found")
    session.delete(invite)
    session.commit()

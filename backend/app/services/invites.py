"""Invites as hosts see them: who is invited, and what they answered."""

import secrets
import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Invite, Person, User
from app.schemas.invites import InviteIn
from app.services.access import require_role
from app.services.errors import NotFound

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
    """One personal link for the given people. For now names are typed in, not taken from the
    address book (D29)."""
    require_role(session, user, event_id, "admin")
    invite = Invite(
        event_id=event_id,
        name=data.name,
        token=new_token(),
        persons=[Person(name=name, position=i) for i, name in enumerate(data.persons)],
    )
    session.add(invite)
    session.commit()
    return invite


def delete_invite(session: Session, user: User, event_id: uuid.UUID, invite_id: uuid.UUID) -> None:
    require_role(session, user, event_id, "admin")
    invite = session.scalar(
        select(Invite).where(Invite.id == invite_id, Invite.event_id == event_id)
    )
    if invite is None:
        raise NotFound("invite not found")
    session.delete(invite)
    session.commit()

import uuid
from collections.abc import Iterable
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Event, EventRole, User
from app.models.management import Role
from app.services.errors import Forbidden, NotFound

_RANK: dict[Role, int] = {"viewer": 0, "admin": 1, "owner": 2}


def require_role(session: Session, user: User, event_id: uuid.UUID, minimum: Role) -> Event:
    """The event, if the user has at least `minimum` on it.

    Events the user has no role on are reported as not found, so IDs reveal nothing.
    """
    role = session.scalar(
        select(EventRole.role).where(EventRole.event_id == event_id, EventRole.user_id == user.id)
    )
    if role is None:
        raise NotFound("event not found")
    if _RANK[role] < _RANK[minimum]:
        raise Forbidden(f"this needs the {minimum} role on the event")
    return session.get_one(Event, event_id)


class _HasId(Protocol):
    id: uuid.UUID


def find[T: _HasId](items: Iterable[T], item_id: uuid.UUID, what: str) -> T:
    """Look a child up among its parent's children only, so an ID from another event or
    question is simply not found."""
    for item in items:
        if item.id == item_id:
            return item
    raise NotFound(f"{what} not found")

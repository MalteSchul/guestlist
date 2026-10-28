"""Guest API behind the personal link. The token travels in a header, so it never appears in
API URLs or backend access logs (A20)."""

from typing import Annotated

from fastapi import APIRouter, Header
from sqlalchemy.orm import Session

from app.db import SessionDep
from app.models import Invite
from app.schemas.invites import GuestInviteOut, GuestListEntry, GuestResponseIn
from app.services import guests

router = APIRouter(prefix="/guest", tags=["guest"])

InviteToken = Annotated[str, Header(alias="X-Invite-Token", min_length=1, max_length=100)]


@router.get("/invite")
def get_invite(session: SessionDep, token: InviteToken) -> GuestInviteOut:
    return _with_guest_list(session, guests.get_invite(session, token))


@router.put("/invite")
def save_response(session: SessionDep, token: InviteToken, data: GuestResponseIn) -> GuestInviteOut:
    return _with_guest_list(session, guests.save_response(session, token, data))


def _with_guest_list(session: Session, invite: Invite) -> GuestInviteOut:
    listed = guests.guest_list(session, invite)
    entries = None if listed is None else [GuestListEntry.model_validate(p) for p in listed]
    return GuestInviteOut.model_validate(invite).model_copy(update={"guest_list": entries})

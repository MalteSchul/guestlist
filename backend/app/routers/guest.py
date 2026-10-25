"""Guest API behind the personal link. The token travels in a header, so it never appears in
API URLs or backend access logs (A20)."""

from typing import Annotated

from fastapi import APIRouter, Header

from app.db import SessionDep
from app.schemas.invites import GuestInviteOut, GuestResponseIn
from app.services import guests

router = APIRouter(prefix="/guest", tags=["guest"])

InviteToken = Annotated[str, Header(alias="X-Invite-Token", min_length=1, max_length=100)]


@router.get("/invite")
def get_invite(session: SessionDep, token: InviteToken) -> GuestInviteOut:
    return GuestInviteOut.model_validate(guests.get_invite(session, token))


@router.put("/invite")
def save_response(session: SessionDep, token: InviteToken, data: GuestResponseIn) -> GuestInviteOut:
    return GuestInviteOut.model_validate(guests.save_response(session, token, data))

"""Guest API behind the personal link and the event's open link (D36). The token travels in a
header, so it never appears in API URLs or backend access logs (A20)."""

from typing import Annotated

from fastapi import APIRouter, Header, status
from sqlalchemy.orm import Session

from app.db import SessionDep
from app.models import Invite
from app.schemas.invites import (
    GuestEvent,
    GuestInviteOut,
    GuestResponseIn,
    GuestSignupOut,
    SignupIn,
    SignupOut,
)
from app.services import guests

router = APIRouter(prefix="/guest", tags=["guest"])

InviteToken = Annotated[str, Header(alias="X-Invite-Token", min_length=1, max_length=100)]
SignupToken = Annotated[str, Header(alias="X-Signup-Token", min_length=1, max_length=100)]


@router.get("/invite")
def get_invite(session: SessionDep, token: InviteToken) -> GuestInviteOut:
    return _with_guest_list(session, guests.get_invite(session, token))


@router.put("/invite")
def save_response(session: SessionDep, token: InviteToken, data: GuestResponseIn) -> GuestInviteOut:
    return _with_guest_list(session, guests.save_response(session, token, data))


@router.get("/signup")
def get_signup(session: SessionDep, token: SignupToken) -> GuestSignupOut:
    return GuestSignupOut(event=GuestEvent.model_validate(guests.get_signup_event(session, token)))


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def sign_up(session: SessionDep, token: SignupToken, data: SignupIn) -> SignupOut:
    return SignupOut(token=guests.sign_up(session, token, data).token)


def _with_guest_list(session: Session, invite: Invite) -> GuestInviteOut:
    entries = guests.guest_list_entries(session, invite.event)
    return GuestInviteOut.model_validate(invite).model_copy(update={"guest_list": entries})

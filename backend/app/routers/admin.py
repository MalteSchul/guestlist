"""Host API. Every endpoint needs a logged-in user; services check their role on the event."""

import uuid

from fastapi import APIRouter, status

from app.auth.dependencies import CurrentUser
from app.db import SessionDep
from app.schemas.events import (
    EventIn,
    EventOut,
    EventSummary,
    OptionIn,
    OptionOut,
    QuestionIn,
    QuestionOut,
    QuestionUpdate,
    SectionIn,
    SectionOut,
)
from app.schemas.invites import InviteIn, InviteOut
from app.schemas.users import UserOut
from app.services import events, invites

router = APIRouter(prefix="/admin", tags=["admin"])

CREATED = {"status_code": status.HTTP_201_CREATED}
NO_CONTENT = {"status_code": status.HTTP_204_NO_CONTENT}


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


# Events


@router.get("/events")
def list_events(session: SessionDep, user: CurrentUser) -> list[EventSummary]:
    return [EventSummary.model_validate(e) for e in events.list_events(session, user)]


@router.post("/events", **CREATED)
def create_event(session: SessionDep, user: CurrentUser, data: EventIn) -> EventOut:
    return EventOut.model_validate(events.create_event(session, user, data))


@router.get("/events/{event_id}")
def get_event(session: SessionDep, user: CurrentUser, event_id: uuid.UUID) -> EventOut:
    return EventOut.model_validate(events.get_event(session, user, event_id))


@router.put("/events/{event_id}")
def update_event(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, data: EventIn
) -> EventOut:
    return EventOut.model_validate(events.update_event(session, user, event_id, data))


@router.delete("/events/{event_id}", **NO_CONTENT)
def delete_event(session: SessionDep, user: CurrentUser, event_id: uuid.UUID) -> None:
    events.delete_event(session, user, event_id)


# Sections


@router.post("/events/{event_id}/sections", **CREATED)
def add_section(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, data: SectionIn
) -> SectionOut:
    return SectionOut.model_validate(events.add_section(session, user, event_id, data))


@router.put("/events/{event_id}/sections/{section_id}")
def update_section(
    session: SessionDep,
    user: CurrentUser,
    event_id: uuid.UUID,
    section_id: uuid.UUID,
    data: SectionIn,
) -> SectionOut:
    section = events.update_section(session, user, event_id, section_id, data)
    return SectionOut.model_validate(section)


@router.delete("/events/{event_id}/sections/{section_id}", **NO_CONTENT)
def delete_section(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, section_id: uuid.UUID
) -> None:
    events.delete_section(session, user, event_id, section_id)


# Questions and their options


@router.post("/events/{event_id}/questions", **CREATED)
def add_question(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, data: QuestionIn
) -> QuestionOut:
    return QuestionOut.model_validate(events.add_question(session, user, event_id, data))


@router.put("/events/{event_id}/questions/{question_id}")
def update_question(
    session: SessionDep,
    user: CurrentUser,
    event_id: uuid.UUID,
    question_id: uuid.UUID,
    data: QuestionUpdate,
) -> QuestionOut:
    question = events.update_question(session, user, event_id, question_id, data)
    return QuestionOut.model_validate(question)


@router.delete("/events/{event_id}/questions/{question_id}", **NO_CONTENT)
def delete_question(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, question_id: uuid.UUID
) -> None:
    events.delete_question(session, user, event_id, question_id)


@router.post("/events/{event_id}/questions/{question_id}/options", **CREATED)
def add_option(
    session: SessionDep,
    user: CurrentUser,
    event_id: uuid.UUID,
    question_id: uuid.UUID,
    data: OptionIn,
) -> OptionOut:
    option = events.add_option(session, user, event_id, question_id, data)
    return OptionOut.model_validate(option)


@router.put("/events/{event_id}/questions/{question_id}/options/{option_id}")
def update_option(
    session: SessionDep,
    user: CurrentUser,
    event_id: uuid.UUID,
    question_id: uuid.UUID,
    option_id: uuid.UUID,
    data: OptionIn,
) -> OptionOut:
    option = events.update_option(session, user, event_id, question_id, option_id, data)
    return OptionOut.model_validate(option)


@router.delete("/events/{event_id}/questions/{question_id}/options/{option_id}", **NO_CONTENT)
def delete_option(
    session: SessionDep,
    user: CurrentUser,
    event_id: uuid.UUID,
    question_id: uuid.UUID,
    option_id: uuid.UUID,
) -> None:
    events.delete_option(session, user, event_id, question_id, option_id)


# Invites


@router.get("/events/{event_id}/invites")
def list_invites(session: SessionDep, user: CurrentUser, event_id: uuid.UUID) -> list[InviteOut]:
    return [InviteOut.model_validate(i) for i in invites.list_invites(session, user, event_id)]


@router.post("/events/{event_id}/invites", **CREATED)
def create_invite(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, data: InviteIn
) -> InviteOut:
    return InviteOut.model_validate(invites.create_invite(session, user, event_id, data))


@router.delete("/events/{event_id}/invites/{invite_id}", **NO_CONTENT)
def delete_invite(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, invite_id: uuid.UUID
) -> None:
    invites.delete_invite(session, user, event_id, invite_id)

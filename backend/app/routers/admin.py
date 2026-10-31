"""Host API. Every endpoint needs a logged-in user; services check their role on the event."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.auth.dependencies import CurrentUser
from app.db import SessionDep
from app.schemas.events import (
    AttendanceCounts,
    EventIn,
    EventOut,
    EventSummary,
    OptionIn,
    OptionOut,
    QuestionIn,
    QuestionOut,
    QuestionUpdate,
)
from app.schemas.invites import (
    GroupInviteIn,
    GroupInviteOut,
    GuestEvent,
    GuestPreviewOut,
    InviteIn,
    InviteOut,
)
from app.schemas.stats import AgeGrouping, EventStats
from app.schemas.users import UserOut
from app.services import events, guests, invites, stats

router = APIRouter(prefix="/admin", tags=["admin"])

CREATED = {"status_code": status.HTTP_201_CREATED}
NO_CONTENT = {"status_code": status.HTTP_204_NO_CONTENT}


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


# Events


@router.get("/events")
def list_events(session: SessionDep, user: CurrentUser) -> list[EventSummary]:
    found = events.list_events(session, user)
    counts = events.attendance_counts(session, [e.id for e in found])
    return [
        EventSummary(
            id=e.id,
            title=e.title,
            starts_at=e.starts_at,
            ends_at=e.ends_at,
            attendance=AttendanceCounts(**counts.get(e.id, {})),
        )
        for e in found
    ]


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


@router.post("/events/{event_id}/duplicate", **CREATED)
def duplicate_event(session: SessionDep, user: CurrentUser, event_id: uuid.UUID) -> EventOut:
    return EventOut.model_validate(events.duplicate_event(session, user, event_id))


@router.delete("/events/{event_id}", **NO_CONTENT)
def delete_event(session: SessionDep, user: CurrentUser, event_id: uuid.UUID) -> None:
    events.delete_event(session, user, event_id)


@router.get("/events/{event_id}/stats")
def event_stats(
    session: SessionDep,
    user: CurrentUser,
    event_id: uuid.UUID,
    grouping: Annotated[AgeGrouping, Query()],
) -> EventStats:
    return stats.event_stats(session, user, event_id, grouping)


@router.get("/events/{event_id}/preview")
def preview_event(session: SessionDep, user: CurrentUser, event_id: uuid.UUID) -> GuestPreviewOut:
    """The invitation as guests see it, without an invite of its own."""
    event = events.get_event(session, user, event_id)
    return GuestPreviewOut(
        event=GuestEvent.model_validate(event),
        guest_list=guests.guest_list_entries(session, event),
    )


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


@router.post("/events/{event_id}/invites/group", **CREATED)
def invite_group(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, data: GroupInviteIn
) -> GroupInviteOut:
    result = invites.invite_group(session, user, event_id, data)
    return GroupInviteOut(
        invites=[InviteOut.model_validate(i) for i in result.invites], skipped=result.skipped
    )


@router.delete("/events/{event_id}/invites/{invite_id}", **NO_CONTENT)
def delete_invite(
    session: SessionDep, user: CurrentUser, event_id: uuid.UUID, invite_id: uuid.UUID
) -> None:
    invites.delete_invite(session, user, event_id, invite_id)

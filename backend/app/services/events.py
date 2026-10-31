"""Events and what hosts set up on them: questions and their options."""

import uuid
from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.models import (
    Event,
    EventQuestion,
    EventQuestionOption,
    EventRole,
    Invite,
    Person,
    PersonAnswerOption,
    User,
)
from app.schemas.events import EventIn, OptionIn, QuestionIn, QuestionUpdate
from app.services.access import find, require_role
from app.services.errors import Conflict, Invalid


def _assign(row: object, data: BaseModel) -> None:
    for field, value in data.model_dump().items():
        setattr(row, field, value)


# Events


def list_events(session: Session, user: User) -> Sequence[Event]:
    return session.scalars(
        select(Event)
        .join(EventRole)
        .where(EventRole.user_id == user.id)
        .order_by(Event.starts_at.desc())
    ).all()


def attendance_counts(
    session: Session, event_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, dict[str, int]]:
    """Per event: how many people answered yes, maybe, no or nothing yet."""
    rows = session.execute(
        select(Invite.event_id, Person.attendance, func.count())
        .join(Person, Person.invite_id == Invite.id)
        .where(Invite.event_id.in_(event_ids))
        .group_by(Invite.event_id, Person.attendance)
    )
    counts: dict[uuid.UUID, dict[str, int]] = {}
    for event_id, attendance, count in rows:
        counts.setdefault(event_id, {})[attendance] = count
    return counts


def create_event(session: Session, user: User, data: EventIn) -> Event:
    """The creator becomes the event's owner."""
    event = Event(**data.model_dump())
    session.add(event)
    session.flush()
    session.add(EventRole(event_id=event.id, user_id=user.id, role="owner"))
    session.commit()
    return event


def get_event(session: Session, user: User, event_id: uuid.UUID) -> Event:
    return require_role(session, user, event_id, "viewer")


def update_event(session: Session, user: User, event_id: uuid.UUID, data: EventIn) -> Event:
    event = require_role(session, user, event_id, "admin")
    _assign(event, data)
    session.commit()
    return event


def duplicate_event(session: Session, user: User, event_id: uuid.UUID) -> Event:
    """A new event with the same details and questions, for the next party of the same
    kind. Invites and answers stay behind, and so do options nobody can pick any more. The user
    becomes the copy's owner."""
    original = require_role(session, user, event_id, "viewer")
    copy = Event(**EventIn.model_validate(original).model_dump())
    copy.questions = [
        EventQuestion(
            label=q.label,
            kind=q.kind,
            multiple=q.multiple,
            required=q.required,
            position=q.position,
            options=[
                EventQuestionOption(label=o.label, position=o.position)
                for o in q.options
                if o.active
            ],
        )
        for q in original.questions
    ]
    session.add(copy)
    session.flush()
    session.add(EventRole(event_id=copy.id, user_id=user.id, role="owner"))
    session.commit()
    return copy


def delete_event(session: Session, user: User, event_id: uuid.UUID) -> None:
    session.delete(require_role(session, user, event_id, "owner"))
    session.commit()


# Questions


def add_question(
    session: Session, user: User, event_id: uuid.UUID, data: QuestionIn
) -> EventQuestion:
    event = require_role(session, user, event_id, "admin")
    question = EventQuestion(
        **data.model_dump(exclude={"options"}),
        options=[EventQuestionOption(**option.model_dump()) for option in data.options],
    )
    event.questions.append(question)
    session.commit()
    return question


def update_question(
    session: Session,
    user: User,
    event_id: uuid.UUID,
    question_id: uuid.UUID,
    data: QuestionUpdate,
) -> EventQuestion:
    event = require_role(session, user, event_id, "admin")
    question = find(event.questions, question_id, "question")
    _assign(question, data)
    session.commit()
    return question


def delete_question(
    session: Session, user: User, event_id: uuid.UUID, question_id: uuid.UUID
) -> None:
    """Also deletes every answer to it."""
    event = require_role(session, user, event_id, "admin")
    event.questions.remove(find(event.questions, question_id, "question"))
    session.commit()


# Options


def _choice_question(event: Event, question_id: uuid.UUID) -> EventQuestion:
    question = find(event.questions, question_id, "question")
    if question.kind != "choice":
        raise Invalid("only choice questions have options")
    return question


def add_option(
    session: Session, user: User, event_id: uuid.UUID, question_id: uuid.UUID, data: OptionIn
) -> EventQuestionOption:
    event = require_role(session, user, event_id, "admin")
    question = _choice_question(event, question_id)
    option = EventQuestionOption(**data.model_dump())
    question.options.append(option)
    session.commit()
    return option


def update_option(
    session: Session,
    user: User,
    event_id: uuid.UUID,
    question_id: uuid.UUID,
    option_id: uuid.UUID,
    data: OptionIn,
) -> EventQuestionOption:
    event = require_role(session, user, event_id, "admin")
    option = find(_choice_question(event, question_id).options, option_id, "option")
    _assign(option, data)
    session.commit()
    return option


def delete_option(
    session: Session,
    user: User,
    event_id: uuid.UUID,
    question_id: uuid.UUID,
    option_id: uuid.UUID,
) -> None:
    """Options someone picked can't be deleted, only set inactive (D24)."""
    event = require_role(session, user, event_id, "admin")
    question = _choice_question(event, question_id)
    option = find(question.options, option_id, "option")
    if session.scalar(select(exists().where(PersonAnswerOption.option_id == option.id))):
        raise Conflict("guests picked this option; set it inactive instead")
    question.options.remove(option)
    session.commit()

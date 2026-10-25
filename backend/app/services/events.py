"""Events and what hosts set up on them: sections, questions, options."""

import uuid
from collections.abc import Sequence

from pydantic import BaseModel
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models import (
    Event,
    EventQuestion,
    EventQuestionOption,
    EventRole,
    EventSection,
    PersonAnswerOption,
    User,
)
from app.schemas.common import Translated
from app.schemas.events import EventIn, OptionIn, QuestionIn, QuestionUpdate, SectionIn
from app.services.access import find, require_role
from app.services.errors import Conflict, Invalid


def _require_language(language: str, *texts: Translated | None) -> None:
    """Host-written text always has the event's default language (data-model.md)."""
    for text in texts:
        if text is not None and getattr(text, language) is None:
            raise Invalid(f"text in the event's default language ({language}) is required")


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


def create_event(session: Session, user: User, data: EventIn) -> Event:
    """The creator becomes the event's owner."""
    _require_language(data.default_language, data.title, data.description)
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
    _require_language(data.default_language, data.title, data.description)
    _assign(event, data)
    session.commit()
    return event


def delete_event(session: Session, user: User, event_id: uuid.UUID) -> None:
    session.delete(require_role(session, user, event_id, "owner"))
    session.commit()


# Sections


def add_section(session: Session, user: User, event_id: uuid.UUID, data: SectionIn) -> EventSection:
    event = require_role(session, user, event_id, "admin")
    _require_language(event.default_language, data.title, data.body)
    section = EventSection(**data.model_dump())
    event.sections.append(section)
    session.commit()
    return section


def update_section(
    session: Session, user: User, event_id: uuid.UUID, section_id: uuid.UUID, data: SectionIn
) -> EventSection:
    event = require_role(session, user, event_id, "admin")
    section = find(event.sections, section_id, "section")
    _require_language(event.default_language, data.title, data.body)
    _assign(section, data)
    session.commit()
    return section


def delete_section(
    session: Session, user: User, event_id: uuid.UUID, section_id: uuid.UUID
) -> None:
    event = require_role(session, user, event_id, "admin")
    event.sections.remove(find(event.sections, section_id, "section"))
    session.commit()


# Questions


def add_question(
    session: Session, user: User, event_id: uuid.UUID, data: QuestionIn
) -> EventQuestion:
    event = require_role(session, user, event_id, "admin")
    _require_language(event.default_language, data.label, *(o.label for o in data.options))
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
    _require_language(event.default_language, data.label)
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
    _require_language(event.default_language, data.label)
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
    _require_language(event.default_language, data.label)
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

"""The database-level rules from data-model.md that matter most if they ever break."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Event,
    EventQuestion,
    EventQuestionOption,
    Invite,
    Person,
    PersonAnswer,
    PersonAnswerOption,
    User,
)
from tests.helpers import check_deferred_constraints


@pytest.fixture
def picked_option(session: Session) -> EventQuestionOption:
    """An event with one choice question whose option one guest has picked."""
    event = Event(title={"de": "Feier"}, starts_at=datetime.now(UTC), default_language="de")
    session.add(event)
    session.flush()
    question = EventQuestion(event_id=event.id, label={"de": "Essen"}, kind="choice", position=0)
    session.add(question)
    session.flush()
    option = EventQuestionOption(question_id=question.id, label={"de": "Vegetarisch"}, position=0)
    invite = Invite(event_id=event.id, name="Familie Müller", token="t" * 43)
    session.add_all([option, invite])
    session.flush()
    person = Person(invite_id=invite.id, name="Anna", position=0)
    session.add(person)
    session.flush()
    answer = PersonAnswer(person_id=person.id, question_id=question.id)
    session.add(answer)
    session.flush()
    session.add(PersonAnswerOption(answer_id=answer.id, option_id=option.id))
    session.flush()
    return option


def test_email_unique_regardless_of_case(session: Session):
    session.add(User(email="Anna@Example.com", display_name="Anna"))
    session.flush()
    session.add(User(email="anna@example.com", display_name="Anna 2"))
    with pytest.raises(IntegrityError, match="uq_users_lower_email"):
        session.flush()


def test_deleting_a_picked_option_is_blocked(session: Session, picked_option):
    session.execute(delete(EventQuestionOption).where(EventQuestionOption.id == picked_option.id))
    with pytest.raises(IntegrityError, match="fk_person_answer_options_option_id"):
        check_deferred_constraints(session)


def test_deleting_the_question_removes_its_options_and_answers(session: Session, picked_option):
    session.execute(delete(EventQuestion).where(EventQuestion.id == picked_option.question_id))
    check_deferred_constraints(session)
    for model in (EventQuestionOption, PersonAnswer, PersonAnswerOption):
        assert session.scalar(select(func.count()).select_from(model)) == 0


def test_deleting_the_event_removes_everything_below_it(session: Session, picked_option):
    question = session.get(EventQuestion, picked_option.question_id)
    session.execute(delete(Event).where(Event.id == question.event_id))
    check_deferred_constraints(session)
    for model in (EventQuestion, EventQuestionOption, Invite, Person, PersonAnswer):
        assert session.scalar(select(func.count()).select_from(model)) == 0


def test_event_cannot_end_before_it_starts(session: Session):
    now = datetime.now(UTC)
    session.add(
        Event(
            title={"de": "x"},
            starts_at=now,
            ends_at=now - timedelta(hours=1),
            default_language="de",
        )
    )
    with pytest.raises(IntegrityError, match="ck_events_ends_after_start"):
        session.flush()

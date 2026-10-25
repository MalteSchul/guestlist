import secrets
import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import (
    EventQuestion,
    EventQuestionOption,
    Invite,
    Person,
    PersonAnswer,
    PersonAnswerOption,
)


def check_deferred_constraints(session: Session) -> None:
    """Run the checks a commit would run; tests never really commit."""
    session.execute(text("SET CONSTRAINTS ALL IMMEDIATE"))


def pick_option(session: Session, option_id: str | uuid.UUID) -> PersonAnswer:
    """A guest on a new invite who picked this option."""
    option = session.get_one(EventQuestionOption, uuid.UUID(str(option_id)))
    question = session.get_one(EventQuestion, option.question_id)
    invite = Invite(event_id=question.event_id, name="Test", token=secrets.token_urlsafe(32))
    session.add(invite)
    session.flush()
    person = Person(invite_id=invite.id, name="Anna", position=0)
    session.add(person)
    session.flush()
    answer = PersonAnswer(person_id=person.id, question_id=question.id)
    session.add(answer)
    session.flush()
    session.add(PersonAnswerOption(answer_id=answer.id, option_id=option.id))
    session.flush()
    return answer

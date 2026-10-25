"""What guests do through their personal link. The token is their only credential."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EventQuestion, Invite, Person, PersonAnswer, PersonAnswerOption
from app.schemas.invites import AnswerIn, GuestResponseIn, PersonResponseIn
from app.services.access import find
from app.services.errors import Conflict, Invalid, NotFound


def get_invite(session: Session, token: str) -> Invite:
    invite = session.scalar(select(Invite).where(Invite.token == token))
    if invite is None:
        raise NotFound("invite not found")
    return invite


def save_response(session: Session, token: str, data: GuestResponseIn) -> Invite:
    """Guests send the whole state of each person they answer for. Answers left out are
    removed (D30)."""
    invite = get_invite(session, token)
    if not invite.event.answers_open:
        raise Conflict("answers are closed")

    # Only this event's questions count: an ID from anywhere else is rejected.
    questions = {question.id: question for question in invite.event.questions}
    for response in data.persons:
        _save_person(find(invite.persons, response.id, "person"), response, questions)
    invite.comment = data.comment
    session.commit()
    return invite


def _save_person(
    person: Person, response: PersonResponseIn, questions: dict[uuid.UUID, EventQuestion]
) -> None:
    if response.attendance != person.attendance:
        person.attendance = response.attendance
        person.attendance_changed_at = datetime.now(UTC)

    given: dict[uuid.UUID, AnswerIn] = {}
    for answer in response.answers:
        question = questions.get(answer.question_id)
        if question is None:
            raise Invalid("this question isn't part of the event")
        if question.id in given:
            raise Invalid("a question can only be answered once per person")
        if answer.option_ids or answer.text_value is not None:
            _check_answer(person, question, answer)
            given[question.id] = answer

    # Required questions only bind guests who said yes; "maybe" may skip them (D27).
    if response.attendance == "yes":
        for question in questions.values():
            if question.required and question.id not in given and _answerable(question):
                raise Invalid(f"please answer every required question for {person.name}")

    _store_answers(person, given)


def _check_answer(person: Person, question: EventQuestion, answer: AnswerIn) -> None:
    if question.kind == "text":
        if answer.option_ids:
            raise Invalid("text questions take text, not options")
        return
    if answer.text_value is not None:
        raise Invalid("choice questions take options, not text")
    picked = set(answer.option_ids)
    if len(picked) > 1 and not question.multiple:
        raise Invalid("pick only one option for this question")
    # New picks need an active option; picks made before it was deactivated may stay (D28).
    earlier = {
        pick for a in person.answers if a.question_id == question.id for pick in a.option_ids
    }
    available = {option.id for option in question.options if option.active} | earlier
    if not picked <= available:
        raise Invalid("this option isn't available for the question")


def _answerable(question: EventQuestion) -> bool:
    return question.kind == "text" or any(option.active for option in question.options)


def _store_answers(person: Person, given: dict[uuid.UUID, AnswerIn]) -> None:
    """Update rows in place rather than replacing them, so unchanged answers keep their
    timestamps."""
    existing = {answer.question_id: answer for answer in person.answers}
    for question_id, answer in existing.items():
        if question_id not in given:
            person.answers.remove(answer)

    for question_id, answer_in in given.items():
        answer = existing.get(question_id)
        if answer is None:
            answer = PersonAnswer(question_id=question_id)
            person.answers.append(answer)
        answer.text_value = answer_in.text_value

        wanted = list(dict.fromkeys(answer_in.option_ids))
        for pick in list(answer.picks):
            if pick.option_id not in wanted:
                answer.picks.remove(pick)
        for option_id in wanted:
            if option_id not in answer.option_ids:
                answer.picks.append(PersonAnswerOption(option_id=option_id))

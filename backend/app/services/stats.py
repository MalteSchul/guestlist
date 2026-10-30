"""What the answers to an event add up to: how they came in over time, and how old the people
coming are. Only sums are given out, so an event's other hosts never see anyone's birth year."""

import uuid
from collections import Counter
from collections.abc import Sequence
from datetime import datetime
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Contact, Invite, Person, User
from app.schemas.stats import AgeBand, AttendanceStep, EventStats
from app.services.access import require_role

STATES = ("yes", "maybe", "no", "pending")
AGE_STEP = 10  # years per band
LAST_BAND_FROM = 80  # "80 and older"
MAX_AGE = 120  # anything above is a typo in a birth year


class _Person(NamedTuple):
    created_at: datetime
    attendance: str
    attendance_changed_at: datetime | None
    birth_year: int | None


def event_stats(session: Session, user: User, event_id: uuid.UUID) -> EventStats:
    event = require_role(session, user, event_id, "viewer")
    rows = session.execute(
        select(
            Person.created_at, Person.attendance, Person.attendance_changed_at, Contact.birth_year
        )
        .join(Invite, Invite.id == Person.invite_id)
        .outerjoin(Contact, Contact.id == Person.contact_id)
        .where(Invite.event_id == event_id)
    ).all()
    people = [_Person(*row) for row in rows]
    ages, unknown = _ages(people, event.starts_at.year)
    return EventStats(timeline=_timeline(people), ages=ages, age_unknown=unknown)


def _timeline(people: Sequence[_Person]) -> list[AttendanceStep]:
    """The counts after each moment someone was invited or answered. Only the last change of
    attendance is kept, so someone who changed their mind counts as pending until then."""
    moves: list[tuple[datetime, str | None, str]] = []  # when, what they leave, what they join
    for person in people:
        moves.append((person.created_at, None, "pending"))
        if person.attendance != "pending":
            answered = person.attendance_changed_at or person.created_at
            moves.append((max(answered, person.created_at), "pending", person.attendance))
    moves.sort(key=lambda move: move[0])  # stable: being invited stays before answering

    counts = dict.fromkeys(STATES, 0)
    steps: list[AttendanceStep] = []
    for at, leaves, joins in moves:
        if leaves:
            counts[leaves] -= 1
        counts[joins] += 1
        step = AttendanceStep(at=at, **counts)
        if steps and steps[-1].at == at:
            steps[-1] = step  # several things at the same moment make one step
        else:
            steps.append(step)
    return steps


def _ages(people: Sequence[_Person], year: int) -> tuple[list[AgeBand], int]:
    """Yes and maybe by decade, 80 and older together; the age is the year of the event minus
    the birth year, so it is right within a year."""
    last = LAST_BAND_FROM // AGE_STEP
    counts = {state: Counter[int]() for state in ("yes", "maybe")}
    unknown = 0
    for person in people:
        if person.attendance not in counts:
            continue
        age = None if person.birth_year is None else year - person.birth_year
        if age is None or not 0 <= age <= MAX_AGE:
            unknown += 1
        else:
            counts[person.attendance][min(age // AGE_STEP, last)] += 1
    bands = [
        AgeBand(
            min_age=band * AGE_STEP,
            max_age=(band + 1) * AGE_STEP - 1 if band < last else None,
            yes=counts["yes"][band],
            maybe=counts["maybe"][band],
        )
        for band in range(last + 1)
    ]
    return bands, unknown

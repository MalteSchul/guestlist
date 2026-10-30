from pydantic import AwareDatetime

from app.schemas.common import Schema


class AttendanceStep(Schema):
    """How many people answered what, from this moment until the next step."""

    at: AwareDatetime
    yes: int
    maybe: int
    no: int
    pending: int
    """Invited, not answered yet."""


class AgeBand(Schema):
    """People who said yes or maybe, by their age on the day of the event."""

    min_age: int
    max_age: int | None
    """`None` for the last band: this age and older."""
    yes: int
    maybe: int


class EventStats(Schema):
    timeline: list[AttendanceStep]
    """After each moment someone was invited or answered, oldest first; empty without invites."""
    ages: list[AgeBand]
    age_unknown: int
    """People who said yes or maybe and have no (sensible) age: not invited from the address
    book, or no birth year there."""

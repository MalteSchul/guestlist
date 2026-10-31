from pydantic import AwareDatetime, Field

from app.schemas.common import Schema

MAX_AGE = 120  # anything above is a typo in a birth year


class AttendanceStep(Schema):
    """How many people answered what, from this moment until the next step."""

    at: AwareDatetime
    yes: int
    maybe: int
    no: int
    pending: int
    """Invited, not answered yet."""


class AgeGrouping(Schema):
    """How the ages are grouped: bands of `age_step` years up to `age_from`, from there on one
    band for everyone older. The last closed band is cut short where `age_from` falls inside it."""

    age_step: int = Field(10, ge=1, le=MAX_AGE)
    age_from: int = Field(80, ge=1, le=MAX_AGE)

    def starts(self) -> list[int]:
        """The age each band starts at; the last one is the open-ended band."""
        return [*range(0, self.age_from, self.age_step), self.age_from]


class AgeBand(Schema):
    """The people invited from the address book, by their age on the day of the event and what
    they answered."""

    min_age: int
    max_age: int | None
    """`None` for the last band: this age and older."""
    yes: int
    maybe: int
    no: int
    pending: int
    """Invited, not answered yet."""


class EventStats(Schema):
    timeline: list[AttendanceStep]
    """After each moment someone was invited or answered, oldest first; empty without invites."""
    ages: list[AgeBand]
    age_unknown: int
    """People invited who have no (sensible) age: not invited from the address book, or no
    birth year there."""

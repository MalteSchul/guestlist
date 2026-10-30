import uuid
from datetime import datetime

from pydantic import AwareDatetime, model_validator

from app.models.event import QuestionKind
from app.schemas.common import LongText, Schema, ShortText


class OptionIn(Schema):
    label: LongText
    active: bool = True
    position: int = 0


class OptionOut(OptionIn):
    id: uuid.UUID


class QuestionUpdate(Schema):
    label: LongText
    required: bool = False
    position: int = 0


class QuestionIn(QuestionUpdate):
    """`kind` and `multiple` are fixed once the question exists (D27)."""

    kind: QuestionKind
    multiple: bool = False
    options: list[OptionIn] = []

    @model_validator(mode="after")
    def options_match_kind(self) -> "QuestionIn":
        if self.kind == "text" and (self.options or self.multiple):
            raise ValueError("text questions have no options and can't be multiple")
        if self.kind == "choice" and not self.options:
            raise ValueError("choice questions need at least one option")
        return self


class QuestionOut(QuestionUpdate):
    id: uuid.UUID
    kind: QuestionKind
    multiple: bool
    options: list[OptionOut]


class SectionIn(Schema):
    title: LongText
    body: LongText
    position: int = 0


class SectionOut(SectionIn):
    id: uuid.UUID


class EventIn(Schema):
    title: LongText
    description: LongText | None = None
    location: ShortText | None = None
    starts_at: AwareDatetime
    ends_at: AwareDatetime | None = None
    rsvp_deadline: AwareDatetime | None = None
    keep_data: bool = False
    guest_list_enabled: bool = False

    @model_validator(mode="after")
    def ends_after_start(self) -> "EventIn":
        if self.ends_at is not None and self.ends_at < self.starts_at:
            raise ValueError("ends_at must not be before starts_at")
        return self


class AttendanceCounts(Schema):
    """How many invited people answered what, over all of an event's invites."""

    yes: int = 0
    maybe: int = 0
    no: int = 0
    pending: int = 0


class EventSummary(Schema):
    id: uuid.UUID
    title: LongText
    starts_at: datetime
    ends_at: datetime | None
    attendance: AttendanceCounts


class EventOut(EventIn):
    id: uuid.UUID
    sections: list[SectionOut]
    questions: list[QuestionOut]

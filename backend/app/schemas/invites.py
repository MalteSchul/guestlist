import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import Field, field_validator

from app.models.event import Language
from app.models.guests import Attendance
from app.schemas.common import LongText, Schema, ShortText, Translated
from app.schemas.events import QuestionOut, SectionOut

# Shared by hosts and guests


class AnswerOut(Schema):
    question_id: uuid.UUID
    option_ids: list[uuid.UUID]
    text_value: str | None


class PersonOut(Schema):
    id: uuid.UUID
    name: str
    attendance: Attendance
    attendance_changed_at: datetime | None
    answers: list[AnswerOut]


# Hosts


class InviteIn(Schema):
    name: ShortText
    persons: Annotated[list[ShortText], Field(min_length=1, max_length=50)]


class InviteOut(Schema):
    id: uuid.UUID
    name: str
    token: str
    comment: str | None
    persons: list[PersonOut]


# Guests


class GuestQuestion(QuestionOut):
    @field_validator("options", mode="before")
    @classmethod
    def only_active(cls, options: list[Any]) -> list[Any]:
        """Inactive options can't be picked any more, so guests don't see them (D28)."""
        return [option for option in options if option.active]


class GuestEvent(Schema):
    title: Translated
    description: Translated | None
    location: str | None
    starts_at: datetime
    ends_at: datetime | None
    default_language: Language
    answers_close_at: datetime
    answers_open: bool
    sections: list[SectionOut]
    questions: list[GuestQuestion]


class GuestInviteOut(Schema):
    name: str
    comment: str | None
    event: GuestEvent
    persons: list[PersonOut]


class AnswerIn(Schema):
    question_id: uuid.UUID
    option_ids: list[uuid.UUID] = []
    text_value: LongText | None = None


class PersonResponseIn(Schema):
    id: uuid.UUID
    attendance: Attendance
    answers: list[AnswerIn] = []


class GuestResponseIn(Schema):
    comment: LongText | None = None
    persons: list[PersonResponseIn]

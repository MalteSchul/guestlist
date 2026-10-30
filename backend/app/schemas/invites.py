import uuid
from datetime import datetime
from typing import Annotated, Any

from pydantic import Field, field_validator

from app.models.address_book import InviteMode
from app.models.guests import Attendance
from app.schemas.common import LongText, Schema, ShortText
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
    attendance_public: bool
    """The guest agreed to be on the guest list (D3)."""
    answers: list[AnswerOut]


# Hosts


class PersonIn(Schema):
    name: ShortText
    contact_id: uuid.UUID | None = None
    """From the host's address book: the name is a copy, the ID the link back (D9)."""


class InviteIn(Schema):
    name: ShortText
    persons: Annotated[list[PersonIn], Field(min_length=1, max_length=50)]


class HostPersonOut(PersonOut):
    contact_id: uuid.UUID | None


class InviteOut(Schema):
    id: uuid.UUID
    name: str
    token: str
    comment: str | None
    persons: list[HostPersonOut]


class GroupInviteIn(Schema):
    group_id: uuid.UUID
    invite_mode: InviteMode | None = None
    """One shared link or one per member; the group's own setting if left out (D31)."""


class GroupInviteOut(Schema):
    invites: list[InviteOut]
    skipped: list[str]
    """Members who were already invited to the event, so they got no second link (D21)."""


# Guests


class GuestQuestion(QuestionOut):
    @field_validator("options", mode="before")
    @classmethod
    def only_active(cls, options: list[Any]) -> list[Any]:
        """Inactive options can't be picked any more, so guests don't see them (D28)."""
        return [option for option in options if option.active]


class GuestEvent(Schema):
    title: str
    description: str | None
    location: str | None
    starts_at: datetime
    ends_at: datetime | None
    answers_close_at: datetime
    answers_open: bool
    guest_list_enabled: bool
    sections: list[SectionOut]
    questions: list[GuestQuestion]


class GuestListEntry(Schema):
    """Someone on the guest list: a name and whether they come, nothing else (D3)."""

    name: str
    attendance: Attendance


class GuestInviteOut(Schema):
    name: str
    comment: str | None
    event: GuestEvent
    persons: list[PersonOut]
    guest_list: list[GuestListEntry] | None = None
    """Who's coming, if the host shows a guest list; only people who agreed (D33)."""


class GuestPreviewOut(Schema):
    """The invitation as guests see it, for the host's preview: no invite, so no persons."""

    event: GuestEvent
    guest_list: list[GuestListEntry] | None = None


class AnswerIn(Schema):
    question_id: uuid.UUID
    option_ids: list[uuid.UUID] = []
    text_value: LongText | None = None


class PersonResponseIn(Schema):
    id: uuid.UUID
    attendance: Attendance
    attendance_public: bool = False
    answers: list[AnswerIn] = []


class GuestResponseIn(Schema):
    comment: LongText | None = None
    persons: list[PersonResponseIn]

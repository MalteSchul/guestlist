import uuid
from typing import Annotated

from pydantic import Field

from app.models.address_book import InviteMode
from app.schemas.common import Schema, ShortText

BirthYear = Annotated[int, Field(ge=1900, le=2100)]


class ContactIn(Schema):
    name: ShortText
    birth_year: BirthYear | None = None
    group_ids: Annotated[list[uuid.UUID], Field(max_length=100)] = []


class ContactOut(Schema):
    id: uuid.UUID
    name: str
    birth_year: int | None
    group_ids: list[uuid.UUID]


class GroupIn(Schema):
    name: ShortText
    invite_mode: InviteMode = "together"
    member_ids: Annotated[list[uuid.UUID], Field(max_length=200)] = []
    """In display order; also the order of the persons when the group is invited."""


class GroupOut(Schema):
    id: uuid.UUID
    name: str
    invite_mode: InviteMode
    member_ids: list[uuid.UUID]


class ImportedContact(Schema):
    """One contact from an address book export, read in the browser (D32)."""

    name: ShortText
    birth_year: BirthYear | None = None
    groups: Annotated[list[ShortText], Field(max_length=20)] = []
    """Labels from the export; each becomes a group, or joins one with the same name."""


class ContactImport(Schema):
    contacts: Annotated[list[ImportedContact], Field(min_length=1, max_length=2000)]


class ImportResult(Schema):
    contacts: int
    groups: int
    """Groups that were created; labels matching an existing group join that one."""

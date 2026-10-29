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


class AddressBookDelete(Schema):
    """Contacts and groups chosen together, to be deleted in one go."""

    contact_ids: Annotated[list[uuid.UUID], Field(max_length=2000)] = []
    group_ids: Annotated[list[uuid.UUID], Field(max_length=200)] = []


class DeleteResult(Schema):
    contacts: int
    groups: int
    """What was deleted; an ID that isn't in the address book (any more) isn't counted."""


class ImportedContact(Schema):
    """One contact from an address book export, read in the browser (D32)."""

    name: ShortText
    birth_year: BirthYear | None = None
    groups: Annotated[list[ShortText], Field(max_length=20)] = []
    """Labels from the export; each becomes a group, or joins one with the same name."""


class ImportedGroup(Schema):
    """A group as this app's own export wrote it down: the setting, and who is in it, in order."""

    name: ShortText
    invite_mode: InviteMode = "separately"
    members: Annotated[list[ShortText], Field(max_length=2000)] = []
    """Names of contacts in this import; they join in this order."""


class ContactImport(Schema):
    contacts: Annotated[list[ImportedContact], Field(min_length=1, max_length=2000)]
    groups: Annotated[list[ImportedGroup], Field(max_length=200)] = []
    """Created first, with their setting, unless a group of that name exists. Without this,
    contacts' labels become groups with the default setting."""


class ImportResult(Schema):
    contacts: int
    skipped: int
    """Names the address book already had, or that came twice: names are unique."""
    groups: int
    """Groups that were created; labels matching an existing group join that one."""

"""The logged-in host's own address book: contacts and groups (D8)."""

import uuid

from fastapi import APIRouter, status

from app.auth.dependencies import CurrentUser
from app.db import SessionDep
from app.schemas.address_book import (
    ContactImport,
    ContactIn,
    ContactOut,
    GroupIn,
    GroupOut,
    ImportResult,
)
from app.services import address_book

router = APIRouter(prefix="/admin", tags=["address book"])

CREATED = {"status_code": status.HTTP_201_CREATED}
NO_CONTENT = {"status_code": status.HTTP_204_NO_CONTENT}


# Contacts


@router.get("/contacts")
def list_contacts(session: SessionDep, user: CurrentUser) -> list[ContactOut]:
    return [ContactOut.model_validate(c) for c in address_book.list_contacts(session, user)]


@router.post("/contacts", **CREATED)
def create_contact(session: SessionDep, user: CurrentUser, data: ContactIn) -> ContactOut:
    return ContactOut.model_validate(address_book.create_contact(session, user, data))


@router.post("/contacts/import")
def import_contacts(session: SessionDep, user: CurrentUser, data: ContactImport) -> ImportResult:
    return address_book.import_contacts(session, user, data)


@router.put("/contacts/{contact_id}")
def update_contact(
    session: SessionDep, user: CurrentUser, contact_id: uuid.UUID, data: ContactIn
) -> ContactOut:
    return ContactOut.model_validate(address_book.update_contact(session, user, contact_id, data))


@router.delete("/contacts/{contact_id}", **NO_CONTENT)
def delete_contact(session: SessionDep, user: CurrentUser, contact_id: uuid.UUID) -> None:
    address_book.delete_contact(session, user, contact_id)


# Groups


@router.get("/groups")
def list_groups(session: SessionDep, user: CurrentUser) -> list[GroupOut]:
    return [GroupOut.model_validate(g) for g in address_book.list_groups(session, user)]


@router.post("/groups", **CREATED)
def create_group(session: SessionDep, user: CurrentUser, data: GroupIn) -> GroupOut:
    return GroupOut.model_validate(address_book.create_group(session, user, data))


@router.put("/groups/{group_id}")
def update_group(
    session: SessionDep, user: CurrentUser, group_id: uuid.UUID, data: GroupIn
) -> GroupOut:
    return GroupOut.model_validate(address_book.update_group(session, user, group_id, data))


@router.delete("/groups/{group_id}", **NO_CONTENT)
def delete_group(session: SessionDep, user: CurrentUser, group_id: uuid.UUID) -> None:
    address_book.delete_group(session, user, group_id)

"""Each user's own contacts and groups (D8). Nobody else ever sees them: another user's IDs are
simply not found."""

import uuid
from collections.abc import Iterable, Sequence

from sqlalchemy import func, select, true
from sqlalchemy.orm import Session

from app.models import Contact, ContactGroup, ContactGroupMember, User
from app.schemas.address_book import ContactImport, ContactIn, GroupIn, ImportResult
from app.services.errors import Conflict, NotFound

# Contacts


def list_contacts(session: Session, user: User) -> Sequence[Contact]:
    return session.scalars(
        select(Contact)
        .where(Contact.owner_user_id == user.id)
        .order_by(func.lower(Contact.name), Contact.created_at)
    ).all()


def own_contacts(session: Session, user: User, ids: Iterable[uuid.UUID]) -> list[Contact]:
    """These contacts, in the given order, if all of them are in the user's address book."""
    wanted = list(dict.fromkeys(ids))
    found = {
        contact.id: contact
        for contact in session.scalars(
            select(Contact).where(Contact.id.in_(wanted), Contact.owner_user_id == user.id)
        )
    }
    if len(found) < len(wanted):
        raise NotFound("contact not found")
    return [found[contact_id] for contact_id in wanted]


def _require_free_name(
    session: Session, user: User, name: str, contact_id: uuid.UUID | None = None
) -> None:
    """No two of a host's contacts share a name, whatever the case: picking from the address
    book by name has to be unambiguous."""
    taken = session.scalar(
        select(Contact.id).where(
            Contact.owner_user_id == user.id,
            func.lower(Contact.name) == func.lower(name),
            Contact.id != contact_id if contact_id else true(),
        )
    )
    if taken:
        raise Conflict("a contact with this name already exists")


def create_contact(session: Session, user: User, data: ContactIn) -> Contact:
    _require_free_name(session, user, data.name)
    contact = Contact(owner_user_id=user.id, name=data.name, birth_year=data.birth_year)
    session.add(contact)
    session.flush()
    _set_groups(session, user, contact, data.group_ids)
    session.commit()
    session.refresh(contact)
    return contact


def update_contact(session: Session, user: User, contact_id: uuid.UUID, data: ContactIn) -> Contact:
    [contact] = own_contacts(session, user, [contact_id])
    _require_free_name(session, user, data.name, contact.id)
    contact.name = data.name
    contact.birth_year = data.birth_year
    _set_groups(session, user, contact, data.group_ids)
    session.commit()
    session.refresh(contact)
    return contact


def delete_contact(session: Session, user: User, contact_id: uuid.UUID) -> None:
    """Invited persons stay in their events and only lose the link back (D9)."""
    [contact] = own_contacts(session, user, [contact_id])
    session.delete(contact)
    session.commit()


def _set_groups(
    session: Session, user: User, contact: Contact, group_ids: Iterable[uuid.UUID]
) -> None:
    """Membership seen from the contact: new groups get them last, others drop them."""
    wanted = {group.id for group in own_groups(session, user, group_ids)}
    for group in list_groups(session, user):
        member = next((m for m in group.members if m.contact_id == contact.id), None)
        if group.id in wanted and member is None:
            group.members.append(_member(contact.id, len(group.members)))
        elif group.id not in wanted and member is not None:
            group.members.remove(member)


# Groups


def list_groups(session: Session, user: User) -> Sequence[ContactGroup]:
    return session.scalars(
        select(ContactGroup)
        .where(ContactGroup.owner_user_id == user.id)
        .order_by(func.lower(ContactGroup.name), ContactGroup.created_at)
    ).all()


def own_groups(session: Session, user: User, ids: Iterable[uuid.UUID]) -> list[ContactGroup]:
    wanted = list(dict.fromkeys(ids))
    found = {
        group.id: group
        for group in session.scalars(
            select(ContactGroup).where(
                ContactGroup.id.in_(wanted), ContactGroup.owner_user_id == user.id
            )
        )
    }
    if len(found) < len(wanted):
        raise NotFound("group not found")
    return [found[group_id] for group_id in wanted]


def create_group(session: Session, user: User, data: GroupIn) -> ContactGroup:
    group = ContactGroup(owner_user_id=user.id, name=data.name, invite_mode=data.invite_mode)
    session.add(group)
    _set_members(session, user, group, data.member_ids)
    session.commit()
    session.refresh(group)
    return group


def update_group(session: Session, user: User, group_id: uuid.UUID, data: GroupIn) -> ContactGroup:
    [group] = own_groups(session, user, [group_id])
    group.name = data.name
    group.invite_mode = data.invite_mode
    _set_members(session, user, group, data.member_ids)
    session.commit()
    session.refresh(group)
    return group


def delete_group(session: Session, user: User, group_id: uuid.UUID) -> None:
    """Only the group goes; its contacts stay in the address book."""
    [group] = own_groups(session, user, [group_id])
    session.delete(group)
    session.commit()


def _set_members(
    session: Session, user: User, group: ContactGroup, member_ids: Iterable[uuid.UUID]
) -> None:
    """A group only holds the user's own contacts (data-model.md), in the given order. Rows
    are kept where possible, so unchanged members keep their timestamps."""
    contacts = own_contacts(session, user, member_ids)
    existing = {member.contact_id: member for member in group.members}
    for member in list(group.members):
        if member.contact_id not in {contact.id for contact in contacts}:
            group.members.remove(member)
    for position, contact in enumerate(contacts):
        member = existing.get(contact.id)
        if member is None:
            group.members.append(_member(contact.id, position))
        else:
            member.position = position


def _member(contact_id: uuid.UUID, position: int) -> ContactGroupMember:
    return ContactGroupMember(contact_id=contact_id, position=position)


# Import


def import_contacts(session: Session, user: User, data: ContactImport) -> ImportResult:
    """Contacts picked from an export (D32). Labels join an existing group with the same name,
    whatever its case, or become new groups, which invite one link per person: labels are
    usually circles like "Work", not households (D31). A name the address book already has, or
    that came earlier in the same import, is skipped: names are unique. Groups the file declares
    (a backup of this app's own) are created with their setting, and the new contacts it lists
    join in its order; an existing group of the same name keeps its setting."""
    groups = {group.name.casefold(): group for group in list_groups(session, user)}
    names = {contact.name.casefold() for contact in list_contacts(session, user)}
    created_contacts = created_groups = 0
    created: dict[str, Contact] = {}
    for declared in data.groups:
        if declared.name.casefold() not in groups:
            group = ContactGroup(
                owner_user_id=user.id, name=declared.name, invite_mode=declared.invite_mode
            )
            session.add(group)
            groups[declared.name.casefold()] = group
            created_groups += 1
    for imported in data.contacts:
        if imported.name.casefold() in names:
            continue
        names.add(imported.name.casefold())
        created_contacts += 1
        contact = Contact(owner_user_id=user.id, name=imported.name, birth_year=imported.birth_year)
        session.add(contact)
        session.flush()
        created[imported.name.casefold()] = contact
        for label in dict.fromkeys(imported.groups):
            group = groups.get(label.casefold())
            if group is None:
                group = ContactGroup(owner_user_id=user.id, name=label, invite_mode="separately")
                session.add(group)
                groups[label.casefold()] = group
                created_groups += 1
            if contact.id not in group.member_ids:
                group.members.append(_member(contact.id, len(group.members)))
    for declared in data.groups:
        group = groups[declared.name.casefold()]
        for name in declared.members:
            contact = created.get(name.casefold())
            if contact is not None and contact.id not in group.member_ids:
                group.members.append(_member(contact.id, len(group.members)))
    session.commit()
    return ImportResult(
        contacts=created_contacts,
        skipped=len(data.contacts) - created_contacts,
        groups=created_groups,
    )

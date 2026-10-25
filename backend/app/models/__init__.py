"""③ SQLAlchemy tables. Importing this package registers all of them on Base.metadata."""

from app.models.address_book import Contact, ContactGroup, ContactGroupMember
from app.models.base import Base
from app.models.event import Event, EventQuestion, EventQuestionOption, EventSection
from app.models.guests import Invite, Person, PersonAnswer, PersonAnswerOption
from app.models.management import EventRole, Identity, User

__all__ = [
    "Base",
    "Contact",
    "ContactGroup",
    "ContactGroupMember",
    "Event",
    "EventQuestion",
    "EventQuestionOption",
    "EventRole",
    "EventSection",
    "Identity",
    "Invite",
    "Person",
    "PersonAnswer",
    "PersonAnswerOption",
    "User",
]

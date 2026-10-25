"""4. The guests: who is invited, who comes, what they answered. Deleted with the event."""

import uuid
from datetime import datetime
from typing import Literal, get_args

from sqlalchemy import ForeignKey, UniqueConstraint, false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UuidPk, check_in, owned_children
from app.models.event import Event

Attendance = Literal["pending", "yes", "no", "maybe"]


class Invite(Timestamps, Base):
    """One personal link."""

    __tablename__ = "invites"

    id: Mapped[UuidPk]
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str]
    token: Mapped[str] = mapped_column(unique=True)
    comment: Mapped[str | None]

    event: Mapped[Event] = relationship()
    persons: Mapped[list["Person"]] = owned_children(lambda: [Person.position, Person.created_at])


class Person(Timestamps, Base):
    __tablename__ = "persons"

    id: Mapped[UuidPk]
    invite_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("invites.id", ondelete="CASCADE"), index=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str]
    attendance: Mapped[str] = mapped_column(server_default=text("'pending'"))
    attendance_changed_at: Mapped[datetime | None]
    attendance_public: Mapped[bool] = mapped_column(server_default=false())
    position: Mapped[int]

    answers: Mapped[list["PersonAnswer"]] = owned_children(lambda: [PersonAnswer.created_at])

    __table_args__ = (check_in("attendance", get_args(Attendance)),)


class PersonAnswer(Timestamps, Base):
    """One person's answer to one question."""

    __tablename__ = "person_answers"

    id: Mapped[UuidPk]
    person_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("persons.id", ondelete="CASCADE"))
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_questions.id", ondelete="CASCADE"), index=True
    )
    text_value: Mapped[str | None]

    picks: Mapped[list["PersonAnswerOption"]] = owned_children(
        lambda: [PersonAnswerOption.created_at]
    )

    __table_args__ = (UniqueConstraint("person_id", "question_id"),)

    @property
    def option_ids(self) -> list[uuid.UUID]:
        return [pick.option_id for pick in self.picks]


class PersonAnswerOption(Timestamps, Base):
    __tablename__ = "person_answer_options"

    answer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("person_answers.id", ondelete="CASCADE"), primary_key=True
    )
    # Deferred: checked at commit, after every cascade has run. Deleting a whole event or
    # question still works; deleting a single picked option is blocked (D24, data-model.md).
    option_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(
            "event_question_options.id",
            ondelete="NO ACTION",
            deferrable=True,
            initially="DEFERRED",
        ),
        primary_key=True,
        index=True,
    )

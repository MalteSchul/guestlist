"""3. The event: what the host sets up."""

import uuid
from datetime import UTC, datetime
from typing import Literal, get_args

from sqlalchemy import CheckConstraint, ForeignKey, false, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, Translated, UuidPk, check_in, owned_children

Language = Literal["de", "en"]
QuestionKind = Literal["choice", "text"]


class Event(Timestamps, Base):
    __tablename__ = "events"

    id: Mapped[UuidPk]
    title: Mapped[Translated]
    description: Mapped[Translated | None]
    location: Mapped[str | None]
    starts_at: Mapped[datetime]
    ends_at: Mapped[datetime | None]
    rsvp_deadline: Mapped[datetime | None]
    default_language: Mapped[str]
    keep_data: Mapped[bool] = mapped_column(server_default=false())
    guest_list_enabled: Mapped[bool] = mapped_column(server_default=false())

    sections: Mapped[list["EventSection"]] = owned_children(
        lambda: [EventSection.position, EventSection.created_at]
    )
    questions: Mapped[list["EventQuestion"]] = owned_children(
        lambda: [EventQuestion.position, EventQuestion.created_at]
    )

    __table_args__ = (
        check_in("default_language", get_args(Language)),
        CheckConstraint("ends_at IS NULL OR ends_at >= starts_at", name="ends_after_start"),
    )

    @property
    def answers_close_at(self) -> datetime:
        """Guests can answer until the RSVP deadline, or until the event starts (D12)."""
        return self.rsvp_deadline or self.starts_at

    @property
    def answers_open(self) -> bool:
        return datetime.now(UTC) < self.answers_close_at


class EventSection(Timestamps, Base):
    """Info cards such as "Dress code" or "Parking"."""

    __tablename__ = "event_sections"

    id: Mapped[UuidPk]
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[Translated]
    body: Mapped[Translated]
    position: Mapped[int]


class EventQuestion(Timestamps, Base):
    __tablename__ = "event_questions"

    id: Mapped[UuidPk]
    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[Translated]
    kind: Mapped[str]
    multiple: Mapped[bool] = mapped_column(server_default=false())
    required: Mapped[bool] = mapped_column(server_default=false())
    position: Mapped[int]

    options: Mapped[list["EventQuestionOption"]] = owned_children(
        lambda: [EventQuestionOption.position, EventQuestionOption.created_at]
    )

    __table_args__ = (
        check_in("kind", get_args(QuestionKind)),
        CheckConstraint("kind = 'choice' OR NOT multiple", name="multiple_only_for_choice"),
    )


class EventQuestionOption(Timestamps, Base):
    __tablename__ = "event_question_options"

    id: Mapped[UuidPk]
    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_questions.id", ondelete="CASCADE"), index=True
    )
    label: Mapped[Translated]
    active: Mapped[bool] = mapped_column(server_default=true())
    position: Mapped[int]

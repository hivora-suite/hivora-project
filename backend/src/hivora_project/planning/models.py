"""Calendar events: dated items of a project that are not cards."""

from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from hivora_project.core.db.base import Base


class CalendarEvent(Base):
    """A project's event, or a personal one (``owner_id``) that only its owner sees."""

    __tablename__ = "calendar_event"
    __table_args__ = (
        CheckConstraint("(project_id IS NULL) <> (owner_id IS NULL)", name="one_scope"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(
        ForeignKey("project.id", ondelete="CASCADE"), index=True
    )
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    # Wall-clock HH:MM shared by the team's instance; both None for a whole-day event.
    start_time: Mapped[str | None] = mapped_column(String(5))
    end_time: Mapped[str | None] = mapped_column(String(5))
    color: Mapped[str] = mapped_column(String(10))
    note: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"))

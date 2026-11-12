"""Projects."""

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from hivora_project.core.db.base import Base, UTCDateTime


class Project(Base):
    __tablename__ = "project"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("user.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    archived_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    # Set on an account's personal project (My kanban): only that account opens it, admins included.
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), unique=True
    )


class ProjectPin(Base):
    """A project an account keeps in its side menu."""

    __tablename__ = "project_pin"

    project_id: Mapped[int] = mapped_column(
        ForeignKey("project.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("user.id", ondelete="CASCADE"), primary_key=True, index=True
    )

"""A card's history: who changed what, when, and from which value to which."""

from datetime import date, datetime, timedelta
from typing import Any, NamedTuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hivora_project.member.models import User
from hivora_project.task.models import Task, TaskEvent

# Autosave sends many small saves: successive edits of one field are a single line,
# from the value before the first to the value after the last.
MERGE_WINDOW = timedelta(minutes=5)
MERGED_ACTIONS = frozenset({"title", "description", "dates", "labels", "assignees", "moved"})


class Change(NamedTuple):
    action: str
    detail: str
    old: str
    new: str


def _dates(start: date | None, due: date | None) -> str:
    return f"{start or '—'} → {due or '—'}" if start or due else ""


async def _names(session: AsyncSession, user_ids: list[int]) -> str:
    rows = await session.scalars(
        select(User.username).where(User.id.in_(user_ids)).order_by(User.username)
    )
    return ", ".join(rows)


async def card_changes(session: AsyncSession, task: Task, changes: dict[str, Any]) -> list[Change]:
    """What these changes really modify; call before applying them."""
    found = []
    if "title" in changes and changes["title"] != task.title:
        found.append(Change("title", changes["title"], task.title, changes["title"]))
    if "description" in changes and changes["description"] != task.description:
        found.append(Change("description", "", task.description, changes["description"]))
    start = changes.get("start_date", task.start_date)
    due = changes.get("due_date", task.due_date)
    if (start, due) != (task.start_date, task.due_date):
        found.append(
            Change("dates", "", _dates(task.start_date, task.due_date), _dates(start, due))
        )
    if "labels" in changes and sorted(changes["labels"]) != sorted(task.labels):
        old, new = ", ".join(sorted(task.labels)), ", ".join(sorted(changes["labels"]))
        found.append(Change("labels", "", old, new))
    current = [a.user_id for a in task.assignees]
    if "assignee_ids" in changes and set(changes["assignee_ids"]) != set(current):
        old, new = await _names(session, current), await _names(session, changes["assignee_ids"])
        found.append(Change("assignees", "", old, new))
    return found


async def record(
    session: AsyncSession,
    task_id: int,
    user_id: int,
    action: str,
    now: datetime,
    detail: str = "",
    *,
    old: str = "",
    new: str = "",
) -> None:
    if action in MERGED_ACTIONS:
        last = await session.scalar(
            select(TaskEvent)
            .where(
                TaskEvent.task_id == task_id,
                TaskEvent.user_id == user_id,
                TaskEvent.action == action,
            )
            .order_by(TaskEvent.id.desc())
            .limit(1)
        )
        if last is not None and now - last.created_at < MERGE_WINDOW:
            if last.old_value == new:  # back where it started: nothing happened
                await session.delete(last)
                return
            last.detail, last.new_value, last.created_at = detail, new, now
            return
    session.add(
        TaskEvent(
            task_id=task_id,
            user_id=user_id,
            action=action,
            detail=detail,
            old_value=old,
            new_value=new,
            created_at=now,
        )
    )


async def events(session: AsyncSession, task_id: int) -> list[tuple[TaskEvent, str | None]]:
    rows = await session.execute(
        select(TaskEvent, User.username)
        .outerjoin(User, User.id == TaskEvent.user_id)
        .where(TaskEvent.task_id == task_id)
        .order_by(TaskEvent.id.desc())
    )
    return [(event, author) for event, author in rows]

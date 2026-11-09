"""Columns and tasks of a project's board."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.clock import Clock
from hivora_project.core.errors import ConflictError, NotFoundError, ValidationError
from hivora_project.member import access
from hivora_project.member.access import Actor
from hivora_project.member.models import ProjectRole
from hivora_project.project.service import open_project
from hivora_project.task.models import BoardColumn, Task

DEFAULT_COLUMNS = {
    "fr": ("À faire", "En cours", "Terminé"),
    "en": ("To do", "In progress", "Done"),
}


class TaskNotFoundError(NotFoundError):
    code = "task_not_found"


class ColumnNotFoundError(NotFoundError):
    code = "column_not_found"


class ColumnNotEmptyError(ConflictError):
    code = "column_not_empty"


class LastColumnError(ConflictError):
    code = "last_column"


class AssigneeNotMemberError(ValidationError):
    code = "assignee_not_member"


class Positioned(Protocol):
    position: int


def place(siblings: Sequence[Positioned], item: Positioned, position: int | None) -> None:
    """Puts ``item`` at ``position`` among ``siblings`` (None: last), renumbering them all."""
    # ponytail: rewrites one column per move, fine at board sizes; ranks if columns get huge
    ordered = [s for s in siblings if s is not item]
    ordered.insert(len(ordered) if position is None else position, item)
    for index, entry in enumerate(ordered):
        entry.position = index


async def create_default_columns(session: AsyncSession, project_id: int, language: str) -> None:
    session.add_all(
        BoardColumn(project_id=project_id, name=name, position=index)
        for index, name in enumerate(DEFAULT_COLUMNS[language])
    )


async def release_assignee(session: AsyncSession, project_id: int, user_id: int) -> None:
    await session.execute(
        update(Task)
        .where(Task.project_id == project_id, Task.assignee_id == user_id)
        .values(assignee_id=None)
    )


async def _columns(session: AsyncSession, project_id: int) -> list[BoardColumn]:
    rows = await session.scalars(
        select(BoardColumn)
        .where(BoardColumn.project_id == project_id)
        .order_by(BoardColumn.position, BoardColumn.id)
    )
    return list(rows)


async def _column(session: AsyncSession, project_id: int, column_id: int) -> BoardColumn:
    column = await session.get(BoardColumn, column_id)
    if column is None or column.project_id != project_id:
        raise ColumnNotFoundError(str(column_id))
    return column


async def _column_tasks(session: AsyncSession, column_id: int) -> list[Task]:
    rows = await session.scalars(
        select(Task).where(Task.column_id == column_id).order_by(Task.position, Task.id)
    )
    return list(rows)


async def _task(session: AsyncSession, project_id: int, task_id: int) -> Task:
    task = await session.get(Task, task_id)
    if task is None or task.project_id != project_id:
        raise TaskNotFoundError(str(task_id))
    return task


async def _check_assignee(session: AsyncSession, project_id: int, user_id: int | None) -> None:
    if user_id is not None and not await access.is_member(session, project_id, user_id):
        raise AssigneeNotMemberError("the assignee must be a member of the project")


@dataclass(frozen=True, slots=True)
class Board:
    columns: list[BoardColumn]
    tasks: list[Task]


class TaskService:
    def __init__(self, *, sessions: async_sessionmaker[AsyncSession], clock: Clock) -> None:
        self.sessions = sessions
        self.clock = clock

    async def board(self, actor: Actor, project_id: int) -> Board:
        async with self.sessions() as session:
            await open_project(session, actor, project_id, ProjectRole.VIEWER, writable=False)
            tasks = await session.scalars(
                select(Task).where(Task.project_id == project_id).order_by(Task.position, Task.id)
            )
            return Board(await _columns(session, project_id), list(tasks))

    # --- columns (managers) --------------------------------------------------
    async def create_column(self, actor: Actor, project_id: int, name: str) -> BoardColumn:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.MANAGER)
            column = BoardColumn(
                project_id=project_id,
                name=name,
                position=len(await _columns(session, project_id)),
            )
            session.add(column)
            return column

    async def update_column(
        self,
        actor: Actor,
        project_id: int,
        column_id: int,
        *,
        name: str | None,
        position: int | None,
    ) -> BoardColumn:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.MANAGER)
            column = await _column(session, project_id, column_id)
            if name is not None:
                column.name = name
            if position is not None:
                place(await _columns(session, project_id), column, position)
            return column

    async def delete_column(self, actor: Actor, project_id: int, column_id: int) -> None:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.MANAGER)
            column = await _column(session, project_id, column_id)
            if await _column_tasks(session, column_id):
                raise ColumnNotEmptyError("move or delete the column's tasks first")
            if len(await _columns(session, project_id)) == 1:
                raise LastColumnError("a board needs at least one column")
            await session.delete(column)

    # --- tasks ---------------------------------------------------------------
    async def create_task(
        self,
        actor: Actor,
        project_id: int,
        *,
        title: str,
        description: str,
        column_id: int | None,
        assignee_id: int | None,
    ) -> Task:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            await _check_assignee(session, project_id, assignee_id)
            target = (
                (await _columns(session, project_id))[0].id
                if column_id is None
                else (await _column(session, project_id, column_id)).id
            )
            position = await session.scalar(
                select(func.count()).select_from(Task).where(Task.column_id == target)
            )
            now = self.clock.now()
            task = Task(
                project_id=project_id,
                column_id=target,
                title=title,
                description=description,
                position=position or 0,
                assignee_id=assignee_id,
                created_by=actor.user_id,
                created_at=now,
                updated_at=now,
            )
            session.add(task)
            return task

    async def update_task(
        self, actor: Actor, project_id: int, task_id: int, changes: dict[str, object]
    ) -> Task:
        """``changes``: only the fields sent; ``assignee_id`` may be None (unassigned)."""
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            task = await _task(session, project_id, task_id)
            if "assignee_id" in changes:
                await _check_assignee(session, project_id, changes["assignee_id"])  # type: ignore[arg-type]
            for field, value in changes.items():
                setattr(task, field, value)
            task.updated_at = self.clock.now()
            return task

    async def move_task(
        self, actor: Actor, project_id: int, task_id: int, column_id: int, position: int
    ) -> Task:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            task = await _task(session, project_id, task_id)
            await _column(session, project_id, column_id)
            task.column_id = column_id
            task.updated_at = self.clock.now()
            place(await _column_tasks(session, column_id), task, position)
            return task

    async def delete_task(self, actor: Actor, project_id: int, task_id: int) -> None:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.MANAGER)
            await session.delete(await _task(session, project_id, task_id))

"""Columns and cards of a project's board."""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.clock import Clock
from hivora_project.core.errors import ConflictError, NotFoundError, ValidationError
from hivora_project.member import access
from hivora_project.member.access import Actor
from hivora_project.member.models import ProjectMember, ProjectRole, Role
from hivora_project.project.models import Project
from hivora_project.project.service import open_project
from hivora_project.task import history
from hivora_project.task.models import (
    BoardColumn,
    ChecklistItem,
    Task,
    TaskAssignee,
    TaskEvent,
    TaskPlacement,
)

DEFAULT_COLUMNS = {
    "fr": ("À faire", "En cours", "Terminé"),
    "en": ("To do", "In progress", "Done"),
}
# A personal project (My kanban) starts with its own inbox column.
PERSONAL_FIRST_COLUMN = {"fr": "Tâches perso", "en": "Personal tasks"}


class TaskNotFoundError(NotFoundError):
    code = "task_not_found"


class ColumnNotFoundError(NotFoundError):
    code = "column_not_found"


class ChecklistItemNotFoundError(NotFoundError):
    code = "checklist_item_not_found"


class ColumnNotEmptyError(ConflictError):
    code = "column_not_empty"


class LastColumnError(ConflictError):
    code = "last_column"


class AssigneeNotMemberError(ValidationError):
    code = "assignee_not_member"


class InvalidDatesError(ValidationError):
    code = "invalid_dates"


class Positioned(Protocol):
    position: int


def place(siblings: Sequence[Positioned], item: Positioned, position: int | None) -> None:
    """Puts ``item`` at ``position`` among ``siblings`` (None: last), renumbering them all."""
    # ponytail: rewrites one column per move, fine at board sizes; ranks if columns get huge
    ordered = [s for s in siblings if s is not item]
    ordered.insert(len(ordered) if position is None else position, item)
    for index, entry in enumerate(ordered):
        entry.position = index


async def create_default_columns(
    session: AsyncSession, project_id: int, language: str, personal: bool
) -> None:
    names = DEFAULT_COLUMNS[language]
    if personal:
        names = (PERSONAL_FIRST_COLUMN[language], *names[1:])
    session.add_all(
        BoardColumn(project_id=project_id, name=name, position=index)
        for index, name in enumerate(names)
    )


async def release_assignee(session: AsyncSession, project_id: int, user_id: int) -> None:
    await session.execute(
        delete(TaskAssignee).where(
            TaskAssignee.user_id == user_id,
            TaskAssignee.task_id.in_(select(Task.id).where(Task.project_id == project_id)),
        )
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


async def _item(session: AsyncSession, project_id: int, item_id: int) -> ChecklistItem:
    item = await session.get(ChecklistItem, item_id)
    task = await session.get(Task, item.task_id) if item else None
    if item is None or task is None or task.project_id != project_id:
        raise ChecklistItemNotFoundError(str(item_id))
    return item


async def _set_assignees(session: AsyncSession, task: Task, user_ids: Iterable[int]) -> None:
    wanted = list(dict.fromkeys(user_ids))
    for user_id in wanted:
        if not await access.is_member(session, task.project_id, user_id):
            raise AssigneeNotMemberError("assignees must be members of the project")
    # Rows that stay are kept: the same key cannot be deleted and inserted in one flush.
    kept = [a for a in task.assignees if a.user_id in wanted]
    present = {a.user_id for a in kept}
    task.assignees = kept + [TaskAssignee(user_id=u) for u in wanted if u not in present]


@dataclass(frozen=True, slots=True)
class Board:
    columns: list[BoardColumn]
    tasks: list[Task]


@dataclass(frozen=True, slots=True)
class MyBoard:
    projects: list[tuple[Project, ProjectRole]]
    tasks: list[tuple[Task, int | None, int | None]]  # with the column of mine it is filed in


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

    async def my_board(self, actor: Actor) -> "MyBoard":
        """The cards assigned to the actor in the open shared projects they can reach,
        with the actor's role in each."""
        async with self.sessions() as session:
            query = (
                select(Task, Project, TaskPlacement.column_id, TaskPlacement.position)
                .join(TaskAssignee, TaskAssignee.task_id == Task.id)
                .join(Project, Project.id == Task.project_id)
                .where(
                    TaskAssignee.user_id == actor.user_id,
                    Project.archived_at.is_(None),
                    Project.owner_id.is_(None),
                )
            )
            if actor.role is not Role.ADMIN:
                query = query.join(
                    ProjectMember,
                    (ProjectMember.project_id == Task.project_id)
                    & (ProjectMember.user_id == actor.user_id),
                )
            query = query.outerjoin(
                TaskPlacement,
                (TaskPlacement.task_id == Task.id) & (TaskPlacement.user_id == actor.user_id),
            )
            order = (TaskPlacement.position, Task.position, Task.id)
            rows = list(await session.execute(query.order_by(*order)))
            projects = {project.id: project for _, project, _, _ in rows}
            roles = {
                pid: ProjectRole.MANAGER
                if actor.role is Role.ADMIN
                else await access.project_role(session, actor, pid, ProjectRole.VIEWER)
                for pid in projects
            }
            return MyBoard(
                [(projects[pid], role) for pid, role in roles.items()],
                [(task, column, position) for task, _, column, position in rows],
            )

    async def move_mine(
        self, actor: Actor, task_id: int, column_id: int | None, position: int
    ) -> None:
        """A move on My kanban. One of my cards moves for real; a shared project card assigned
        to me is only filed in my column (None: back among the project tasks), its project
        column unchanged. Both kinds share one order per column of mine."""
        async with self.sessions() as session, session.begin():
            task = await session.get(Task, task_id)
            project = await session.get(Project, task.project_id) if task else None
            if task is None or project is None:
                raise TaskNotFoundError(str(task_id))
            column = await session.get(BoardColumn, column_id) if column_id else None
            home = await session.get(Project, column.project_id) if column else None
            mine_column = column if home and home.owner_id == actor.user_id else None
            item: Task | TaskPlacement
            if project.owner_id == actor.user_id:
                if mine_column is None:
                    raise ColumnNotFoundError(str(column_id))
                if task.column_id != mine_column.id:
                    previous = await _column(session, task.project_id, task.column_id)
                    await history.record(
                        session,
                        task.id,
                        actor.user_id,
                        "moved",
                        self.clock.now(),
                        mine_column.name,
                        old=previous.name,
                        new=mine_column.name,
                    )
                task.column_id, task.updated_at = mine_column.id, self.clock.now()
                item = task
            else:
                assigned = await session.get(TaskAssignee, (task_id, actor.user_id))
                if project.owner_id is not None or assigned is None:
                    raise TaskNotFoundError(str(task_id))
                filed = await session.get(TaskPlacement, (actor.user_id, task_id))
                if column_id is None:
                    if filed is not None:
                        await session.delete(filed)
                    return
                if mine_column is None:
                    raise ColumnNotFoundError(str(column_id))
                if filed is None:
                    filed = TaskPlacement(user_id=actor.user_id, task_id=task_id, position=0)
                    session.add(filed)
                filed.column_id = mine_column.id
                item = filed
            own = await session.scalars(
                select(Task).where(Task.column_id == mine_column.id, Task.id != task_id)
            )
            others = await session.scalars(
                select(TaskPlacement).where(
                    TaskPlacement.column_id == mine_column.id,
                    TaskPlacement.user_id == actor.user_id,
                    TaskPlacement.task_id != task_id,
                )
            )
            # Cards first on a tie: they get numbered by the project routes too.
            siblings: list[Task | TaskPlacement] = sorted(
                [*own, *others], key=lambda e: (e.position, isinstance(e, TaskPlacement))
            )
            place(siblings, item, position)

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

    # --- cards ---------------------------------------------------------------
    async def create_task(
        self, actor: Actor, project_id: int, *, title: str, description: str, column_id: int | None
    ) -> Task:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
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
                labels=[],
                assignees=[],
                checklist=[],
                created_by=actor.user_id,
                created_at=now,
                updated_at=now,
            )
            session.add(task)
            await session.flush()
            await history.record(session, task.id, actor.user_id, "created", now)
            return task

    async def update_task(
        self, actor: Actor, project_id: int, task_id: int, changes: dict[str, Any]
    ) -> Task:
        """``changes``: only the fields sent."""
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            task = await _task(session, project_id, task_id)
            events = await history.card_changes(session, task, changes)
            start = changes.get("start_date", task.start_date)
            due = changes.get("due_date", task.due_date)
            if start and due and due < start:
                raise InvalidDatesError("the due date is before the start date")
            if "assignee_ids" in changes:
                await _set_assignees(session, task, changes.pop("assignee_ids"))
            for field, value in changes.items():
                setattr(task, field, value)
            task.updated_at = self.clock.now()
            for change in events:
                await history.record(
                    session,
                    task.id,
                    actor.user_id,
                    change.action,
                    task.updated_at,
                    change.detail,
                    old=change.old,
                    new=change.new,
                )
            return task

    async def move_task(
        self, actor: Actor, project_id: int, task_id: int, column_id: int, position: int
    ) -> Task:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            task = await _task(session, project_id, task_id)
            column = await _column(session, project_id, column_id)
            if task.column_id != column_id:
                previous = await _column(session, project_id, task.column_id)
                await history.record(
                    session,
                    task.id,
                    actor.user_id,
                    "moved",
                    self.clock.now(),
                    column.name,
                    old=previous.name,
                    new=column.name,
                )
            task.column_id = column_id
            task.updated_at = self.clock.now()
            place(await _column_tasks(session, column_id), task, position)
            return task

    async def delete_task(self, actor: Actor, project_id: int, task_id: int) -> None:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.MANAGER)
            await session.delete(await _task(session, project_id, task_id))

    # --- checklist -----------------------------------------------------------
    async def add_item(self, actor: Actor, project_id: int, task_id: int, title: str) -> None:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            task = await _task(session, project_id, task_id)
            task.checklist.append(ChecklistItem(title=title, position=len(task.checklist)))
            await history.record(
                session, task.id, actor.user_id, "check_added", self.clock.now(), title
            )

    async def update_item(
        self, actor: Actor, project_id: int, item_id: int, changes: dict[str, Any]
    ) -> None:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            item = await _item(session, project_id, item_id)
            if "done" in changes and changes["done"] != item.done:
                action = "check_done" if changes["done"] else "check_undone"
                await history.record(
                    session, item.task_id, actor.user_id, action, self.clock.now(), item.title
                )
            for field, value in changes.items():
                setattr(item, field, value)

    async def delete_item(self, actor: Actor, project_id: int, item_id: int) -> None:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            item = await _item(session, project_id, item_id)
            await history.record(
                session, item.task_id, actor.user_id, "check_removed", self.clock.now(), item.title
            )
            await session.delete(item)

    # --- history -------------------------------------------------------------
    async def history(
        self, actor: Actor, project_id: int, task_id: int
    ) -> list[tuple[TaskEvent, str | None]]:
        async with self.sessions() as session:
            await open_project(session, actor, project_id, ProjectRole.VIEWER, writable=False)
            await _task(session, project_id, task_id)
            return await history.events(session, task_id)

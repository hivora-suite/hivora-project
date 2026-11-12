"""Board routes (/api/v1/projects/{id}/...). Each action's role is checked by the service."""

from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field, StringConstraints

from hivora_project.member.models import ProjectRole
from hivora_project.project.api import Description, actor
from hivora_project.task.models import BoardColumn, Task
from hivora_project.web.deps import Member, RuntimeDep

router = APIRouter(tags=["board"])
me_router = APIRouter(tags=["board"])

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
ColumnName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]
Position = Annotated[int, Field(ge=0)]
LabelColor = Literal[
    "red",
    "orange",
    "amber",
    "lime",
    "green",
    "teal",
    "cyan",
    "blue",
    "indigo",
    "violet",
    "pink",
    "gray",
]


class ColumnOut(BaseModel):
    id: int
    name: str
    position: int
    done: bool = Field(description="The board's Done column: a card in it is validated")


class ChecklistItemOut(BaseModel):
    id: int
    title: str
    done: bool


class TaskOut(BaseModel):
    id: int
    column_id: int
    title: str
    description: str
    position: int
    start_date: date | None
    due_date: date | None
    labels: list[LabelColor]
    done: bool = Field(description="Validated")
    assignee_ids: list[int]
    checklist: list[ChecklistItemOut]


class BoardOut(BaseModel):
    columns: list[ColumnOut]
    tasks: list[TaskOut]


class TaskEventOut(BaseModel):
    id: int
    action: str
    detail: str
    old_value: str
    new_value: str
    author: str | None
    created_at: datetime


class ColumnCreateIn(BaseModel):
    name: ColumnName


class ColumnUpdateIn(BaseModel):
    name: ColumnName | None = None
    position: Position | None = None
    done: bool | None = None


class TaskCreateIn(BaseModel):
    title: Title
    description: Description = ""
    column_id: int | None = None


class TaskUpdateIn(BaseModel):
    """Only the fields sent change; the dates may be null to clear them."""

    title: Title = Field(default=None)  # type: ignore[assignment]
    description: Description = Field(default=None)  # type: ignore[assignment]
    start_date: date | None = None
    due_date: date | None = None
    labels: list[LabelColor] = Field(default=None)  # type: ignore[arg-type]
    assignee_ids: list[int] = Field(default=None)  # type: ignore[arg-type]


class TaskMoveIn(BaseModel):
    column_id: int
    position: Position


class ItemCreateIn(BaseModel):
    title: Title


class ItemUpdateIn(BaseModel):
    title: Title = Field(default=None)  # type: ignore[assignment]
    done: bool = Field(default=None)  # type: ignore[assignment]


def column_out(c: BoardColumn) -> ColumnOut:
    return ColumnOut(id=c.id, name=c.name, position=c.position, done=c.done)


def task_out(t: Task) -> TaskOut:
    return TaskOut(
        id=t.id,
        column_id=t.column_id,
        title=t.title,
        description=t.description,
        position=t.position,
        start_date=t.start_date,
        due_date=t.due_date,
        labels=t.labels,  # type: ignore[arg-type]
        done=t.done,
        assignee_ids=[a.user_id for a in t.assignees],
        checklist=[ChecklistItemOut(id=i.id, title=i.title, done=i.done) for i in t.checklist],
    )


class MyProjectOut(BaseModel):
    id: int
    name: str
    role: ProjectRole


class MyTaskOut(TaskOut):
    project_id: int
    personal_column_id: int | None = Field(description="My kanban column it is filed in")
    personal_position: int | None


class MyMoveIn(BaseModel):
    task_id: int
    column_id: int | None = Field(description="A column of mine; null: back to project tasks")
    position: Position


class MyBoardOut(BaseModel):
    projects: list[MyProjectOut]
    tasks: list[MyTaskOut]


@me_router.get("/board")
async def my_board(principal: Member, rt: RuntimeDep) -> MyBoardOut:
    """My cards in every shared project (not my personal one), with my role in each."""
    found = await rt.tasks.my_board(actor(principal))
    return MyBoardOut(
        projects=[MyProjectOut(id=p.id, name=p.name, role=role) for p, role in found.projects],
        tasks=[
            MyTaskOut(
                **task_out(t).model_dump(),
                project_id=t.project_id,
                personal_column_id=c,
                personal_position=pos,
            )
            for t, c, pos in found.tasks
        ],
    )


@me_router.post("/board/move", status_code=204)
async def move_mine(body: MyMoveIn, principal: Member, rt: RuntimeDep) -> None:
    """Moves a card on My kanban: mine for real, a project card only in my own order."""
    await rt.tasks.move_mine(actor(principal), body.task_id, body.column_id, body.position)


@router.get("/{project_id}/board")
async def board(project_id: int, principal: Member, rt: RuntimeDep) -> BoardOut:
    found = await rt.tasks.board(actor(principal), project_id)
    return BoardOut(
        columns=[column_out(c) for c in found.columns], tasks=[task_out(t) for t in found.tasks]
    )


@router.post("/{project_id}/columns", status_code=201)
async def create_column(
    project_id: int, body: ColumnCreateIn, principal: Member, rt: RuntimeDep
) -> ColumnOut:
    return column_out(await rt.tasks.create_column(actor(principal), project_id, body.name))


@router.patch("/{project_id}/columns/{column_id}")
async def update_column(
    project_id: int, column_id: int, body: ColumnUpdateIn, principal: Member, rt: RuntimeDep
) -> ColumnOut:
    column = await rt.tasks.update_column(
        actor(principal),
        project_id,
        column_id,
        name=body.name,
        position=body.position,
        done=body.done,
    )
    return column_out(column)


@router.delete("/{project_id}/columns/{column_id}", status_code=204)
async def delete_column(project_id: int, column_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.tasks.delete_column(actor(principal), project_id, column_id)


@router.post("/{project_id}/tasks", status_code=201)
async def create_task(
    project_id: int, body: TaskCreateIn, principal: Member, rt: RuntimeDep
) -> TaskOut:
    task = await rt.tasks.create_task(actor(principal), project_id, **body.model_dump())
    return task_out(task)


@router.patch("/{project_id}/tasks/{task_id}")
async def update_task(
    project_id: int, task_id: int, body: TaskUpdateIn, principal: Member, rt: RuntimeDep
) -> TaskOut:
    changes = body.model_dump(exclude_unset=True)
    return task_out(await rt.tasks.update_task(actor(principal), project_id, task_id, changes))


@router.post("/{project_id}/tasks/{task_id}/move")
async def move_task(
    project_id: int, task_id: int, body: TaskMoveIn, principal: Member, rt: RuntimeDep
) -> TaskOut:
    task = await rt.tasks.move_task(
        actor(principal), project_id, task_id, body.column_id, body.position
    )
    return task_out(task)


@router.post("/{project_id}/tasks/{task_id}/complete", status_code=204)
async def complete_task(project_id: int, task_id: int, principal: Member, rt: RuntimeDep) -> None:
    """Validates a card: a status, the card does not move."""
    await rt.tasks.set_done(actor(principal), project_id, task_id, True)


@router.delete("/{project_id}/tasks/{task_id}/complete", status_code=204)
async def reopen_task(project_id: int, task_id: int, principal: Member, rt: RuntimeDep) -> None:
    """No longer validated; the card does not move."""
    await rt.tasks.set_done(actor(principal), project_id, task_id, False)


@router.delete("/{project_id}/tasks/{task_id}", status_code=204)
async def delete_task(project_id: int, task_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.tasks.delete_task(actor(principal), project_id, task_id)


@router.get("/{project_id}/tasks/{task_id}/history")
async def task_history(
    project_id: int, task_id: int, principal: Member, rt: RuntimeDep
) -> list[TaskEventOut]:
    return [
        TaskEventOut(
            id=event.id,
            action=event.action,
            detail=event.detail,
            old_value=event.old_value,
            new_value=event.new_value,
            author=author,
            created_at=event.created_at,
        )
        for event, author in await rt.tasks.history(actor(principal), project_id, task_id)
    ]


@router.post("/{project_id}/tasks/{task_id}/checklist", status_code=204)
async def add_item(
    project_id: int, task_id: int, body: ItemCreateIn, principal: Member, rt: RuntimeDep
) -> None:
    await rt.tasks.add_item(actor(principal), project_id, task_id, body.title)


@router.patch("/{project_id}/checklist/{item_id}", status_code=204)
async def update_item(
    project_id: int, item_id: int, body: ItemUpdateIn, principal: Member, rt: RuntimeDep
) -> None:
    await rt.tasks.update_item(
        actor(principal), project_id, item_id, body.model_dump(exclude_unset=True)
    )


@router.delete("/{project_id}/checklist/{item_id}", status_code=204)
async def delete_item(project_id: int, item_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.tasks.delete_item(actor(principal), project_id, item_id)

"""Calendar event routes (/api/v1/projects/{id}/events). Roles are checked by the service."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter
from pydantic import BaseModel, StringConstraints

from hivora_project.planning.models import CalendarEvent
from hivora_project.project.api import actor
from hivora_project.task.api import LabelColor, Title
from hivora_project.web.deps import Member, RuntimeDep

router = APIRouter(tags=["planning"])
# My personal events (/api/v1/me/events): no project, only their owner.
me_router = APIRouter(tags=["planning"])

Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
# 24:00 ends an event at midnight.
Time = Annotated[str, StringConstraints(pattern=r"^(([01]\d|2[0-3]):[0-5]\d|24:00)$")]


class EventOut(BaseModel):
    id: int
    title: str
    start_date: date
    end_date: date
    start_time: str | None
    end_time: str | None
    color: LabelColor
    note: str


class EventIn(BaseModel):
    title: Title
    start_date: date
    end_date: date
    start_time: Time | None = None
    end_time: Time | None = None
    color: LabelColor = "blue"
    note: Note = ""


class EventUpdateIn(BaseModel):
    title: Title | None = None
    start_date: date | None = None
    end_date: date | None = None
    start_time: Time | None = None
    end_time: Time | None = None
    color: LabelColor | None = None
    note: Note | None = None


def changes(body: EventUpdateIn) -> dict[str, object]:
    """null clears the times (a whole-day event); it leaves the other fields as they are."""
    return {
        k: v
        for k, v in body.model_dump(exclude_unset=True).items()
        if v is not None or k in ("start_time", "end_time")
    }


def event_out(e: CalendarEvent) -> EventOut:
    return EventOut(
        id=e.id,
        title=e.title,
        start_date=e.start_date,
        end_date=e.end_date,
        start_time=e.start_time,
        end_time=e.end_time,
        color=e.color,  # type: ignore[arg-type]
        note=e.note,
    )


@router.get("/{project_id}/events")
async def list_events(project_id: int, principal: Member, rt: RuntimeDep) -> list[EventOut]:
    return [event_out(e) for e in await rt.events.list_events(actor(principal), project_id)]


@router.post("/{project_id}/events", status_code=201)
async def create_event(
    project_id: int, body: EventIn, principal: Member, rt: RuntimeDep
) -> EventOut:
    return event_out(await rt.events.create(actor(principal), project_id, body.model_dump()))


@router.patch("/{project_id}/events/{event_id}")
async def update_event(
    project_id: int, event_id: int, body: EventUpdateIn, principal: Member, rt: RuntimeDep
) -> EventOut:
    fields = changes(body)
    return event_out(await rt.events.update(actor(principal), project_id, event_id, fields))


@router.delete("/{project_id}/events/{event_id}", status_code=204)
async def delete_event(project_id: int, event_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.events.delete(actor(principal), project_id, event_id)


@me_router.get("/events")
async def my_events(principal: Member, rt: RuntimeDep) -> list[EventOut]:
    return [event_out(e) for e in await rt.events.list_events(actor(principal), None)]


@me_router.post("/events", status_code=201)
async def create_my_event(body: EventIn, principal: Member, rt: RuntimeDep) -> EventOut:
    return event_out(await rt.events.create(actor(principal), None, body.model_dump()))


@me_router.patch("/events/{event_id}")
async def update_my_event(
    event_id: int, body: EventUpdateIn, principal: Member, rt: RuntimeDep
) -> EventOut:
    return event_out(await rt.events.update(actor(principal), None, event_id, changes(body)))


@me_router.delete("/events/{event_id}", status_code=204)
async def delete_my_event(event_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.events.delete(actor(principal), None, event_id)

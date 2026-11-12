"""Calendar events. A project's: viewers read them, contributors and managers change them.
A personal one (no project, ``project_id`` None): only its owner, even for admins."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.errors import NotFoundError, ValidationError
from hivora_project.member.access import Actor
from hivora_project.member.models import ProjectRole
from hivora_project.planning.models import CalendarEvent
from hivora_project.project.service import open_project


class EventNotFoundError(NotFoundError):
    code = "event_not_found"


class EventService:
    def __init__(self, *, sessions: async_sessionmaker[AsyncSession]) -> None:
        self.sessions = sessions

    async def list_events(self, actor: Actor, project_id: int | None) -> list[CalendarEvent]:
        async with self.sessions() as session:
            await _open(session, actor, project_id, ProjectRole.VIEWER, writable=False)
            rows = await session.scalars(
                select(CalendarEvent)
                .where(
                    CalendarEvent.project_id == project_id
                    if project_id is not None
                    else CalendarEvent.owner_id == actor.user_id
                )
                .order_by(CalendarEvent.start_date, CalendarEvent.id)
            )
            return list(rows)

    async def create(
        self, actor: Actor, project_id: int | None, fields: dict[str, object]
    ) -> CalendarEvent:
        async with self.sessions() as session, session.begin():
            await _open(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            event = CalendarEvent(
                project_id=project_id,
                owner_id=actor.user_id if project_id is None else None,
                created_by=actor.user_id,
                **fields,
            )
            ordered(event)
            session.add(event)
            return event

    async def update(
        self, actor: Actor, project_id: int | None, event_id: int, fields: dict[str, object]
    ) -> CalendarEvent:
        async with self.sessions() as session, session.begin():
            await _open(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            event = await _event(session, actor, project_id, event_id)
            for name, value in fields.items():
                setattr(event, name, value)
            ordered(event)
            return event

    async def delete(self, actor: Actor, project_id: int | None, event_id: int) -> None:
        async with self.sessions() as session, session.begin():
            await _open(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            await session.delete(await _event(session, actor, project_id, event_id))


async def _open(
    session: AsyncSession,
    actor: Actor,
    project_id: int | None,
    needed: ProjectRole,
    *,
    writable: bool = True,
) -> None:
    if project_id is not None:
        await open_project(session, actor, project_id, needed, writable=writable)


async def _event(
    session: AsyncSession, actor: Actor, project_id: int | None, event_id: int
) -> CalendarEvent:
    event = await session.get(CalendarEvent, event_id)
    if (
        event is None
        or event.project_id != project_id
        or (project_id is None and event.owner_id != actor.user_id)
    ):
        raise EventNotFoundError(str(event_id))
    return event


class EventDatesError(ValidationError):
    code = "event_dates"


class EventTimesError(ValidationError):
    code = "event_times"


def ordered(e: CalendarEvent) -> None:
    if (e.start_time is None) != (e.end_time is None):
        raise EventTimesError("an event has both times or none")
    timed_same_day = e.start_time is not None and e.start_date == e.end_date
    if e.end_date < e.start_date or (timed_same_day and (e.end_time or "") <= (e.start_time or "")):
        raise EventDatesError("an event cannot end before it starts")

"""Projects, and the membership actions a project allows; membership lives in `member.access`."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.clock import Clock
from hivora_project.core.errors import ConflictError
from hivora_project.member import access
from hivora_project.member.access import Actor, MemberInfo, ProjectNotFoundError
from hivora_project.member.models import ProjectMember, ProjectRole, Role, User
from hivora_project.project.models import Project, ProjectPin


class ProjectArchivedError(ConflictError):
    code = "project_archived"


class PersonalProjectError(ConflictError):
    code = "personal_project"


@dataclass(frozen=True, slots=True)
class ProjectView:
    project: Project
    role: ProjectRole
    pinned: bool = False


async def open_project(
    session: AsyncSession,
    actor: Actor,
    project_id: int,
    needed: ProjectRole,
    *,
    writable: bool = True,
) -> ProjectView:
    """The project, once the actor's role is checked: the other contexts go through here.
    A personal project opens for its owner only, as manager; for anyone else it does not exist."""
    project = await session.get(Project, project_id)
    if project is None or project.owner_id not in (None, actor.user_id):
        raise ProjectNotFoundError(str(project_id))
    role = (
        ProjectRole.MANAGER
        if project.owner_id is not None
        else await access.project_role(session, actor, project_id, needed)
    )
    if writable and project.archived_at is not None:
        raise ProjectArchivedError("this project is archived")
    return ProjectView(project, role)


def shared(view: ProjectView) -> ProjectView:
    """A personal project has no members, pin, archive or deletion."""
    if view.project.owner_id is not None:
        raise PersonalProjectError("not possible on a personal project")
    return view


async def with_pin(session: AsyncSession, actor: Actor, view: ProjectView) -> ProjectView:
    pin = await session.get(ProjectPin, (view.project.id, actor.user_id))
    return replace(view, pinned=pin is not None)


class ProjectService:
    def __init__(
        self,
        *,
        sessions: async_sessionmaker[AsyncSession],
        clock: Clock,
        on_created: Callable[[AsyncSession, int, str, bool], Awaitable[None]],
        on_member_removed: Callable[[AsyncSession, int, int], Awaitable[None]],
    ) -> None:
        self.sessions = sessions
        self.clock = clock
        self.on_created = on_created  # set by `runtime`: this context knows nothing of the others
        self.on_member_removed = on_member_removed

    async def list_projects(self, actor: Actor, *, archived: bool) -> list[ProjectView]:
        async with self.sessions() as session:
            query = (
                select(Project, ProjectMember.role, ProjectPin.user_id)
                .outerjoin(
                    ProjectMember,
                    (ProjectMember.project_id == Project.id)
                    & (ProjectMember.user_id == actor.user_id),
                )
                .outerjoin(
                    ProjectPin,
                    (ProjectPin.project_id == Project.id) & (ProjectPin.user_id == actor.user_id),
                )
            )
            if actor.role is not Role.ADMIN:
                query = query.where(ProjectMember.user_id == actor.user_id)
            query = query.where(Project.owner_id.is_(None))
            if not archived:
                query = query.where(Project.archived_at.is_(None))
            rows = await session.execute(query.order_by(func.lower(Project.name), Project.id))
            return [
                ProjectView(
                    project,
                    ProjectRole.MANAGER if actor.role is Role.ADMIN else role,
                    pin is not None,
                )
                for project, role, pin in rows
            ]

    async def create(self, actor: Actor, name: str, description: str, language: str) -> ProjectView:
        async with self.sessions() as session, session.begin():
            project = Project(
                name=name,
                description=description,
                created_by=actor.user_id,
                created_at=self.clock.now(),
            )
            session.add(project)
            await session.flush()
            await access.add_creator(session, project.id, actor.user_id)
            session.add(ProjectPin(project_id=project.id, user_id=actor.user_id))
            await self.on_created(session, project.id, language, False)
        return ProjectView(project, ProjectRole.MANAGER, pinned=True)

    async def personal(self, actor: Actor, language: str) -> ProjectView:
        """The actor's personal project, created with its default columns on first use.
        ponytail: two first uses at once fail one on the unique owner; retry if it shows up."""
        async with self.sessions() as session, session.begin():
            project = await session.scalar(select(Project).where(Project.owner_id == actor.user_id))
            if project is None:
                project = Project(
                    name="Personal",
                    created_by=actor.user_id,
                    created_at=self.clock.now(),
                    owner_id=actor.user_id,
                )
                session.add(project)
                await session.flush()
                await self.on_created(session, project.id, language, True)
            return ProjectView(project, ProjectRole.MANAGER)

    async def get(self, actor: Actor, project_id: int) -> ProjectView:
        async with self.sessions() as session:
            view = await open_project(
                session, actor, project_id, ProjectRole.VIEWER, writable=False
            )
            return await with_pin(session, actor, view)

    async def update(
        self, actor: Actor, project_id: int, *, name: str | None, description: str | None
    ) -> ProjectView:
        async with self.sessions() as session, session.begin():
            view = await open_project(session, actor, project_id, ProjectRole.MANAGER)
            if name is not None:
                view.project.name = name
            if description is not None:
                view.project.description = description
            return await with_pin(session, actor, view)

    async def set_archived(self, actor: Actor, project_id: int, *, archived: bool) -> ProjectView:
        async with self.sessions() as session, session.begin():
            view = shared(
                await open_project(session, actor, project_id, ProjectRole.MANAGER, writable=False)
            )
            view.project.archived_at = self.clock.now() if archived else None
            return await with_pin(session, actor, view)

    async def set_pinned(self, actor: Actor, project_id: int, *, pinned: bool) -> None:
        """Pins or unpins the project in the actor's side menu; repeating it changes nothing."""
        async with self.sessions() as session, session.begin():
            shared(
                await open_project(session, actor, project_id, ProjectRole.VIEWER, writable=False)
            )
            if not pinned:
                await session.execute(
                    delete(ProjectPin).where(
                        ProjectPin.project_id == project_id, ProjectPin.user_id == actor.user_id
                    )
                )
            elif await session.get(ProjectPin, (project_id, actor.user_id)) is None:
                session.add(ProjectPin(project_id=project_id, user_id=actor.user_id))

    async def delete(self, actor: Actor, project_id: int) -> None:
        """Columns, cards, comments, history and members go with it (database cascades)."""
        async with self.sessions() as session, session.begin():
            view = shared(
                await open_project(session, actor, project_id, ProjectRole.MANAGER, writable=False)
            )
            await session.delete(view.project)

    async def members(self, actor: Actor, project_id: int) -> list[MemberInfo]:
        async with self.sessions() as session:
            await open_project(session, actor, project_id, ProjectRole.VIEWER, writable=False)
            return await access.list_members(session, project_id)

    async def candidates(self, actor: Actor, project_id: int) -> list[User]:
        async with self.sessions() as session:
            shared(await open_project(session, actor, project_id, ProjectRole.MANAGER))
            return await access.list_candidates(session, project_id)

    async def set_member(
        self, actor: Actor, project_id: int, user_id: int, role: ProjectRole
    ) -> None:
        async with self.sessions() as session, session.begin():
            shared(await open_project(session, actor, project_id, ProjectRole.MANAGER))
            await access.set_member(session, project_id, user_id, role)

    async def remove_member(self, actor: Actor, project_id: int, user_id: int) -> None:
        async with self.sessions() as session, session.begin():
            shared(await open_project(session, actor, project_id, ProjectRole.MANAGER))
            await access.remove_member(session, project_id, user_id)
            await self.on_member_removed(session, project_id, user_id)

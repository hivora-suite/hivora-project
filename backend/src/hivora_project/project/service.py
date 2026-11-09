"""Projects, and the membership actions a project allows; membership lives in `member.access`."""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.clock import Clock
from hivora_project.core.errors import ConflictError
from hivora_project.member import access
from hivora_project.member.access import Actor, MemberInfo, ProjectNotFoundError
from hivora_project.member.models import ProjectMember, ProjectRole, Role, User
from hivora_project.project.models import Project


class ProjectArchivedError(ConflictError):
    code = "project_archived"


@dataclass(frozen=True, slots=True)
class ProjectView:
    project: Project
    role: ProjectRole


class ProjectService:
    def __init__(self, *, sessions: async_sessionmaker[AsyncSession], clock: Clock) -> None:
        self.sessions = sessions
        self.clock = clock

    async def _open(
        self,
        session: AsyncSession,
        actor: Actor,
        project_id: int,
        needed: ProjectRole,
        *,
        writable: bool = True,
    ) -> ProjectView:
        role = await access.project_role(session, actor, project_id, needed)
        project = await session.get(Project, project_id)
        if project is None:
            raise ProjectNotFoundError(str(project_id))
        if writable and project.archived_at is not None:
            raise ProjectArchivedError("this project is archived")
        return ProjectView(project, role)

    async def list_projects(self, actor: Actor, *, archived: bool) -> list[ProjectView]:
        async with self.sessions() as session:
            query = select(Project, ProjectMember.role).outerjoin(
                ProjectMember,
                (ProjectMember.project_id == Project.id) & (ProjectMember.user_id == actor.user_id),
            )
            if actor.role is not Role.ADMIN:
                query = query.where(ProjectMember.user_id == actor.user_id)
            if not archived:
                query = query.where(Project.archived_at.is_(None))
            rows = await session.execute(query.order_by(func.lower(Project.name), Project.id))
            return [
                ProjectView(project, ProjectRole.MANAGER if actor.role is Role.ADMIN else role)
                for project, role in rows
            ]

    async def create(self, actor: Actor, name: str, description: str) -> ProjectView:
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
        return ProjectView(project, ProjectRole.MANAGER)

    async def get(self, actor: Actor, project_id: int) -> ProjectView:
        async with self.sessions() as session:
            return await self._open(session, actor, project_id, ProjectRole.VIEWER, writable=False)

    async def update(
        self, actor: Actor, project_id: int, *, name: str | None, description: str | None
    ) -> ProjectView:
        async with self.sessions() as session, session.begin():
            view = await self._open(session, actor, project_id, ProjectRole.MANAGER)
            if name is not None:
                view.project.name = name
            if description is not None:
                view.project.description = description
            return view

    async def set_archived(self, actor: Actor, project_id: int, *, archived: bool) -> ProjectView:
        async with self.sessions() as session, session.begin():
            view = await self._open(session, actor, project_id, ProjectRole.MANAGER, writable=False)
            view.project.archived_at = self.clock.now() if archived else None
            return view

    async def members(self, actor: Actor, project_id: int) -> list[MemberInfo]:
        async with self.sessions() as session:
            await self._open(session, actor, project_id, ProjectRole.VIEWER, writable=False)
            return await access.list_members(session, project_id)

    async def candidates(self, actor: Actor, project_id: int) -> list[User]:
        async with self.sessions() as session:
            await self._open(session, actor, project_id, ProjectRole.MANAGER)
            return await access.list_candidates(session, project_id)

    async def set_member(
        self, actor: Actor, project_id: int, user_id: int, role: ProjectRole
    ) -> None:
        async with self.sessions() as session, session.begin():
            await self._open(session, actor, project_id, ProjectRole.MANAGER)
            await access.set_member(session, project_id, user_id, role)

    async def remove_member(self, actor: Actor, project_id: int, user_id: int) -> None:
        async with self.sessions() as session, session.begin():
            await self._open(session, actor, project_id, ProjectRole.MANAGER)
            await access.remove_member(session, project_id, user_id)

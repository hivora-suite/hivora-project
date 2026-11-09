"""Project membership and access: the Member context's public interface for the others.

An account outside a project gets a 404, so a project's existence is never revealed.
"""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from hivora_project.core.errors import ConflictError, NotFoundError, PermissionDeniedError
from hivora_project.member.models import ProjectMember, ProjectRole, Role, User


class UserNotFoundError(NotFoundError):
    code = "user_not_found"


class ProjectNotFoundError(NotFoundError):
    code = "project_not_found"


class MemberNotFoundError(NotFoundError):
    code = "member_not_found"


class InsufficientProjectRoleError(PermissionDeniedError):
    code = "insufficient_role"


class LastManagerError(ConflictError):
    code = "last_manager"


@dataclass(frozen=True, slots=True)
class Actor:
    user_id: int
    role: Role


@dataclass(frozen=True, slots=True)
class MemberInfo:
    user_id: int
    username: str
    role: ProjectRole


async def project_role(
    session: AsyncSession, actor: Actor, project_id: int, needed: ProjectRole
) -> ProjectRole:
    """The actor's role in the project, at least ``needed``. Instance admins are managers."""
    role = (
        ProjectRole.MANAGER
        if actor.role is Role.ADMIN
        else await session.scalar(
            select(ProjectMember.role).where(
                ProjectMember.project_id == project_id, ProjectMember.user_id == actor.user_id
            )
        )
    )
    if role is None:
        raise ProjectNotFoundError(str(project_id))
    if not role.allows(needed):
        raise InsufficientProjectRoleError("insufficient role", required=needed.value)
    return role


async def list_members(session: AsyncSession, project_id: int) -> list[MemberInfo]:
    rows = await session.execute(
        select(ProjectMember.user_id, User.username, ProjectMember.role)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
        .order_by(User.username)
    )
    return [MemberInfo(*row) for row in rows]


async def list_memberships(session: AsyncSession, user_id: int) -> list[ProjectMember]:
    return list(
        await session.scalars(select(ProjectMember).where(ProjectMember.user_id == user_id))
    )


async def list_candidates(session: AsyncSession, project_id: int) -> list[User]:
    """Active accounts not yet in the project."""
    members = select(ProjectMember.user_id).where(ProjectMember.project_id == project_id)
    rows = await session.scalars(
        select(User)
        .where(User.disabled.is_(False), User.id.not_in(members))
        .order_by(User.username)
    )
    return list(rows)


async def is_member(session: AsyncSession, project_id: int, user_id: int) -> bool:
    return await session.get(ProjectMember, (project_id, user_id)) is not None


async def _other_managers(session: AsyncSession, project_id: int, user_id: int) -> int:
    count = await session.scalar(
        select(func.count()).where(
            ProjectMember.project_id == project_id,
            ProjectMember.role == ProjectRole.MANAGER,
            ProjectMember.user_id != user_id,
        )
    )
    return count or 0


async def add_creator(session: AsyncSession, project_id: int, user_id: int) -> None:
    session.add(ProjectMember(project_id=project_id, user_id=user_id, role=ProjectRole.MANAGER))


async def set_member(
    session: AsyncSession, project_id: int, user_id: int, role: ProjectRole
) -> None:
    """Adds the account to the project, or changes its role."""
    user = await session.get(User, user_id)
    if user is None or user.disabled:
        raise UserNotFoundError(str(user_id))
    member = await session.get(ProjectMember, (project_id, user_id))
    if member is None:
        session.add(ProjectMember(project_id=project_id, user_id=user_id, role=role))
        return
    if (
        member.role is ProjectRole.MANAGER
        and role is not ProjectRole.MANAGER
        and not await _other_managers(session, project_id, user_id)
    ):
        raise LastManagerError("a project needs at least one manager")
    member.role = role


async def remove_member(session: AsyncSession, project_id: int, user_id: int) -> None:
    member = await session.get(ProjectMember, (project_id, user_id))
    if member is None:
        raise MemberNotFoundError(str(user_id))
    if member.role is ProjectRole.MANAGER and not await _other_managers(
        session, project_id, user_id
    ):
        raise LastManagerError("a project needs at least one manager")
    await session.delete(member)


async def is_only_manager_somewhere(session: AsyncSession, user_id: int) -> bool:
    """Would removing this account leave a project without a manager?"""
    projects = await session.scalars(
        select(ProjectMember.project_id).where(
            ProjectMember.user_id == user_id, ProjectMember.role == ProjectRole.MANAGER
        )
    )
    for project_id in projects.all():
        if not await _other_managers(session, project_id, user_id):
            return True
    return False

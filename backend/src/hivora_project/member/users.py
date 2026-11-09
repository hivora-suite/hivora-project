"""User administration (admins only): accounts, roles, resets, sessions of others.

Never zero active admin: demoting, disabling or deleting the last one is refused.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.clock import Clock
from hivora_project.core.crypto.passwords import hash_password
from hivora_project.core.errors import ConflictError
from hivora_project.member.access import (
    LastManagerError,
    UserNotFoundError,
    is_only_manager_somewhere,
)
from hivora_project.member.models import Role, User
from hivora_project.member.passwords import check_password_policy, validate_username
from hivora_project.member.sessions import revoke_sessions
from hivora_project.member.totp import clear_totp


class LastAdminError(ConflictError):
    code = "last_admin"


async def get_user(session: AsyncSession, user_id: int) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise UserNotFoundError(str(user_id))
    return user


class UserAdmin:
    def __init__(self, *, sessions: async_sessionmaker[AsyncSession], clock: Clock) -> None:
        self.sessions = sessions
        self.clock = clock

    async def list_users(self) -> list[User]:
        async with self.sessions() as session:
            return list(await session.scalars(select(User).order_by(User.username)))

    async def create_user(self, username: str, role: Role, password: str) -> User:
        username = validate_username(username)
        check_password_policy(password, username)
        async with self.sessions() as session, session.begin():
            if await session.scalar(select(User.id).where(User.username == username)):
                raise ConflictError("username already taken", field="username")
            user = User(
                username=username,
                password_hash=hash_password(password),
                role=role,
                must_change_password=True,
                created_at=self.clock.now(),
            )
            session.add(user)
        return user

    async def update_user(
        self, user_id: int, *, role: Role | None = None, disabled: bool | None = None
    ) -> User:
        async with self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            new_role = role if role is not None else user.role
            new_disabled = disabled if disabled is not None else user.disabled
            if (
                user.role is Role.ADMIN
                and not user.disabled
                and (new_role is not Role.ADMIN or new_disabled)
            ):
                await self._ensure_other_admin(session, user.id)
            user.role, user.disabled = new_role, new_disabled
            if new_disabled:
                await revoke_sessions(session, user.id)
        return user

    async def reset_password(self, user_id: int, temporary: str) -> None:
        async with self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            check_password_policy(temporary, user.username)
            user.password_hash = hash_password(temporary)
            user.must_change_password = True
            await revoke_sessions(session, user.id)

    async def reset_totp(self, user_id: int) -> None:
        async with self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            clear_totp(user)
            await revoke_sessions(session, user.id)  # a stolen session cannot enroll a new one

    async def delete_user(self, user_id: int, *, acting_user_id: int) -> None:
        if user_id == acting_user_id:
            raise ConflictError("you cannot delete your own account")
        async with self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            if user.role is Role.ADMIN and not user.disabled:
                await self._ensure_other_admin(session, user.id)
            if await is_only_manager_somewhere(session, user.id):
                raise LastManagerError("this account is the only manager of a project")
            await session.delete(user)

    async def revoke_sessions(self, user_id: int, *, keep: int | None = None) -> None:
        async with self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            await revoke_sessions(session, user.id, keep=keep)

    async def _ensure_other_admin(self, session: AsyncSession, user_id: int) -> None:
        others = await session.scalar(
            select(func.count(User.id)).where(
                User.role == Role.ADMIN, User.disabled.is_(False), User.id != user_id
            )
        )
        if not others:
            raise LastAdminError("at least one active admin is required")

"""One-time passwords, and the recovery of an account from the machine itself."""

import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.crypto.passwords import hash_password
from hivora_project.member.access import UserNotFoundError
from hivora_project.member.models import User
from hivora_project.member.sessions import revoke_sessions
from hivora_project.member.totp import clear_totp

ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no 0/o, 1/l/i: read from a terminal
GROUPS, GROUP = 4, 5  # 20 characters, about 99 bits


def random_password() -> str:
    """20 random characters in groups of 5 (``kq7mz-x3wpt-…``)."""
    chars = "".join(secrets.choice(ALPHABET) for _ in range(GROUPS * GROUP))
    return "-".join(chars[i : i + GROUP] for i in range(0, len(chars), GROUP))


async def reset_account(sessions: async_sessionmaker[AsyncSession], username: str) -> str:
    """A lost account: new one-time password, TOTP off, sessions closed."""
    password = random_password()
    async with sessions() as session, session.begin():
        user = await session.scalar(select(User).where(User.username == username))
        if user is None:
            raise UserNotFoundError(username)
        user.password_hash = hash_password(password)
        user.must_change_password = True
        clear_totp(user)
        await revoke_sessions(session, user.id)
    return password

"""Authentication, sessions and the second factor; user administration in `auth.users`.

Rules and pieces it relies on: `passwords` (policy, Argon2id), `sessions` (cookie token,
CSRF, revocation), `totp` (codes accepted once, recovery codes), `ratelimit` (attempts).
"""

import asyncio
from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.clock import Clock, SystemClock
from hivora_project.core.config import Settings
from hivora_project.core.crypto.cipher import SecretBox
from hivora_project.core.crypto.passwords import hash_password, needs_rehash, verify_password
from hivora_project.core.crypto.totp import generate_recovery_codes, hash_recovery_code
from hivora_project.core.errors import ConflictError, HivoraError
from hivora_project.member.initial import random_password
from hivora_project.member.models import Role, Session, User
from hivora_project.member.passwords import DEFAULT_ADMIN, check_password_policy, dummy_hash
from hivora_project.member.ratelimit import LoginRateLimiter
from hivora_project.member.sessions import (
    LAST_SEEN_RESOLUTION,
    hash_token,
    new_session,
    revoke_sessions,
)
from hivora_project.member.totp import TotpEnrollment, TotpGuard, clear_totp
from hivora_project.member.users import UserAdmin, get_user


class AuthError(HivoraError):
    code = "not_authenticated"


class InvalidCredentialsError(AuthError):
    code = "invalid_credentials"


class TotpRequiredError(AuthError):
    code = "totp_required"


class TotpMandatoryError(ConflictError):
    code = "totp_mandatory"  # a public instance: TOTP cannot be turned off


@dataclass(frozen=True, slots=True)
class LoginResult:
    user: User
    session: Session
    token: str  # raw cookie value, never stored


class AuthService:
    def __init__(
        self,
        *,
        settings: Settings,
        sessions: async_sessionmaker[AsyncSession],
        box: SecretBox,
        clock: Clock | None = None,
    ) -> None:
        self.settings = settings
        self.sessions = sessions
        self.box = box
        self.clock = clock or SystemClock()
        self.totp = TotpGuard(box, self.clock)
        self.limiter = LoginRateLimiter(self.clock)
        # Check and record of an attempt in one step, or parallel requests pass the check
        # before any failure counts. Costs nothing: Argon2 already blocks the event loop.
        self._attempts = asyncio.Lock()
        self.users = UserAdmin(sessions=sessions, clock=self.clock)

    # --- bootstrap ------------------------------------------------------------
    async def ensure_initial_admin(self) -> str | None:
        """First start only: creates admin, which must change its password at first login.
        Returns the generated password, to show once (None: nothing created, or chosen by
        the operator through the environment)."""
        chosen = self.settings.initial_admin_password
        password = chosen.get_secret_value() if chosen else random_password()
        async with self.sessions() as session, session.begin():
            if await session.scalar(select(func.count(User.id))):
                return None
            session.add(
                User(
                    username=DEFAULT_ADMIN,
                    password_hash=hash_password(password),
                    role=Role.ADMIN,
                    must_change_password=True,
                    created_at=self.clock.now(),
                )
            )
        return None if chosen else password

    # --- login / sessions -----------------------------------------------------
    async def login(
        self,
        username: str,
        password: str,
        *,
        totp_code: str | None = None,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> LoginResult:
        username = username.strip().lower()
        keys = (f"ip:{ip}", f"user:{username}")
        async with self._attempts, self.sessions() as session, session.begin():
            self.limiter.check(*keys)
            user = await session.scalar(select(User).where(User.username == username))
            valid = verify_password(user.password_hash if user else dummy_hash(), password)
            if not user or not valid or user.disabled:
                self.limiter.failure(*keys)
                raise InvalidCredentialsError("invalid username or password")
            if user.totp_enabled:
                if not totp_code:
                    raise TotpRequiredError("TOTP code required")
                if not self.totp.check(user, totp_code):
                    self.limiter.failure(*keys)
                    raise InvalidCredentialsError("invalid TOTP code")
            self.limiter.success(*keys)
            if needs_rehash(user.password_hash):
                user.password_hash = hash_password(password)
            now = self.clock.now()
            user.last_login_at = now
            record, token = new_session(user, ip=ip, user_agent=user_agent, now=now,
                                        max_days=self.settings.session_max_days)  # fmt: skip
            session.add(record)
        return LoginResult(user, record, token)

    async def authenticate(self, token: str) -> tuple[User, Session] | None:
        now = self.clock.now()
        async with self.sessions() as session, session.begin():
            record = await session.scalar(
                select(Session).where(Session.token_hash == hash_token(token))
            )
            if record is None:
                return None
            idle = timedelta(hours=self.settings.session_idle_hours)
            user = await session.get(User, record.user_id)
            if (
                record.expires_at <= now
                or record.last_seen_at + idle <= now
                or (user is None or user.disabled)
            ):
                await session.delete(record)
                return None
            if now - record.last_seen_at >= LAST_SEEN_RESOLUTION:
                record.last_seen_at = now
            return user, record

    async def logout(self, session_id: int) -> None:
        async with self.sessions() as session, session.begin():
            await session.execute(delete(Session).where(Session.id == session_id))

    async def list_sessions(self, user_id: int) -> list[Session]:
        async with self.sessions() as session:
            rows = await session.scalars(
                select(Session).where(Session.user_id == user_id).order_by(Session.id.desc())
            )
            return list(rows)

    # --- self service -----------------------------------------------------------
    async def change_password(
        self, user_id: int, current: str, new: str, *, keep_session: int | None = None
    ) -> None:
        async with self._attempts, self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            self._attempt(
                f"user:{user.username}", lambda: verify_password(user.password_hash, current)
            )
            check_password_policy(new, user.username)
            user.password_hash = hash_password(new)
            user.must_change_password = False
            await revoke_sessions(session, user.id, keep=keep_session)

    async def totp_enroll(self, user_id: int) -> TotpEnrollment:
        async with self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            if user.totp_enabled:
                raise ConflictError("TOTP already enabled")
            return self.totp.enroll(user)

    async def totp_confirm(self, user_id: int, code: str) -> list[str]:
        """Enable TOTP after a first valid code; returns the recovery codes (shown once)."""
        async with self._attempts, self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            if user.totp_enabled or user.totp_ciphertext is None:
                raise ConflictError("no TOTP enrollment in progress")
            self._attempt(f"enroll:{user.id}", lambda: self.totp.accept(user, code))
            codes = generate_recovery_codes()
            user.recovery_codes = [hash_recovery_code(c) for c in codes]
            user.totp_enabled = True
        return codes

    async def totp_disable(self, user_id: int, password: str, *, keep_session: int) -> None:
        async with self._attempts, self.sessions() as session, session.begin():
            user = await get_user(session, user_id)
            self._attempt(
                f"user:{user.username}", lambda: verify_password(user.password_hash, password)
            )
            if self.settings.access == "public":
                raise TotpMandatoryError(
                    "this instance is public: two-factor authentication is required"
                )
            clear_totp(user)
            await revoke_sessions(session, user.id, keep=keep_session)

    def _attempt(self, key: str, valid: Callable[[], bool]) -> None:
        """A password or code checked from a session, rate limited like a login (under
        ``_attempts``): a stolen session cannot guess its way further."""
        self.limiter.check(key)
        if not valid():
            self.limiter.failure(key)
            raise InvalidCredentialsError("invalid password or code")
        self.limiter.success(key)

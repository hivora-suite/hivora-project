"""FastAPI dependencies: runtime access, authentication, roles and CSRF."""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Request

from hivora_project.core.errors import PermissionDeniedError
from hivora_project.member.models import Role
from hivora_project.member.service import AuthError
from hivora_project.member.sessions import csrf_matches
from hivora_project.member.totp import setup_required
from hivora_project.runtime import Runtime

SESSION_COOKIE = "hivora_project_session"
CSRF_HEADER = "X-CSRF-Token"
_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class PasswordChangeRequiredError(PermissionDeniedError):
    code = "password_change_required"


class TotpSetupRequiredError(PermissionDeniedError):
    code = "totp_setup_required"


class CsrfError(PermissionDeniedError):
    code = "csrf_failed"


class InsufficientRoleError(PermissionDeniedError):
    code = "insufficient_role"


@dataclass(frozen=True, slots=True)
class Principal:
    user_id: int
    username: str
    role: Role
    must_change_password: bool
    totp_enabled: bool
    session_id: int
    csrf_token: str


def get_runtime(request: Request) -> Runtime:
    runtime: Runtime = request.app.state.runtime
    return runtime


RuntimeDep = Annotated[Runtime, Depends(get_runtime)]


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


async def session_principal(request: Request, runtime: RuntimeDep) -> Principal:
    """Any valid session, even one that must still change its password."""
    token = request.cookies.get(SESSION_COOKIE)
    found = await runtime.auth.authenticate(token) if token else None
    if found is None:
        raise AuthError("authentication required")
    user, session = found
    if request.method not in _SAFE_METHODS and not csrf_matches(
        session.csrf_token, request.headers.get(CSRF_HEADER)
    ):
        raise CsrfError("missing or invalid CSRF token")
    return Principal(
        user.id,
        user.username,
        user.role,
        user.must_change_password,
        user.totp_enabled,
        session.id,
        session.csrf_token,
    )


SessionPrincipal = Annotated[Principal, Depends(session_principal)]


def require(role: Role, *, totp: bool = True) -> Callable[..., Awaitable[Principal]]:
    """Full access check, in this order: password changed, TOTP set up when the instance is
    public (``totp=False``: the routes that set it up), at least ``role``."""

    async def dependency(principal: SessionPrincipal, runtime: RuntimeDep) -> Principal:
        if principal.must_change_password:
            raise PasswordChangeRequiredError("change your password first")
        if totp and setup_required(runtime.settings.access, principal.totp_enabled):
            raise TotpSetupRequiredError("set up two-factor authentication first")
        if not principal.role.allows(role):
            raise InsufficientRoleError("insufficient role", required=role.value)
        return principal

    return dependency


Member = Annotated[Principal, Depends(require(Role.MEMBER))]
Admin = Annotated[Principal, Depends(require(Role.ADMIN))]
# Setting TOTP up, allowed before it is (a public instance requires it everywhere else).
TotpSetup = Annotated[Principal, Depends(require(Role.MEMBER, totp=False))]

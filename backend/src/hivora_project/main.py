"""ASGI entrypoint: builds the FastAPI application."""

from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from importlib.metadata import version

from fastapi import FastAPI, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from hivora_project.core.config import Settings
from hivora_project.member.api import router as auth_router
from hivora_project.member.users_api import router as users_router
from hivora_project.planning.api import me_router as my_events_router
from hivora_project.planning.api import router as events_router
from hivora_project.project.api import router as projects_router
from hivora_project.runtime import Runtime
from hivora_project.task.api import me_router
from hivora_project.task.api import router as board_router
from hivora_project.task.comments_api import router as comments_router
from hivora_project.web import errors

API_PREFIX = "/api/v1"
VERSION = version("hivora-project")
# Never framed (clickjacking, even from a sibling subdomain), no MIME sniffing, no referrer out.
SECURITY_HEADERS = {
    "Content-Security-Policy": "frame-ancestors 'none'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
}


class Health(BaseModel):
    status: str
    version: str
    source_url: str


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        runtime = Runtime.build(resolved)
        app.state.runtime = runtime
        await runtime.start()
        try:
            yield
        finally:
            await runtime.stop()

    app = FastAPI(
        title="Hivora Project",
        version=VERSION,
        lifespan=lifespan,
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json",
    )
    errors.install(app)

    @app.middleware("http")
    async def security_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        return response

    app.include_router(auth_router, prefix=f"{API_PREFIX}/auth")
    app.include_router(users_router, prefix=f"{API_PREFIX}/users")
    app.include_router(projects_router, prefix=f"{API_PREFIX}/projects")
    app.include_router(board_router, prefix=f"{API_PREFIX}/projects")
    app.include_router(comments_router, prefix=f"{API_PREFIX}/projects")
    app.include_router(events_router, prefix=f"{API_PREFIX}/projects")
    app.include_router(me_router, prefix=f"{API_PREFIX}/me")
    app.include_router(my_events_router, prefix=f"{API_PREFIX}/me")

    @app.get(f"{API_PREFIX}/system/health")
    async def health() -> Health:
        """Public: used by the container healthcheck and the login page."""
        return Health(status="ok", version=VERSION, source_url=resolved.source_url)

    # Last: the UI answers every path the API does not.
    if resolved.frontend_dir.is_dir():
        app.mount("/", StaticFiles(directory=resolved.frontend_dir, html=True), "ui")
    return app

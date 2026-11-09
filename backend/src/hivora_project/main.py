"""ASGI entrypoint: builds the FastAPI application."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from importlib.metadata import version

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from hivora_project.core.config import Settings
from hivora_project.member.api import router as auth_router
from hivora_project.member.users_api import router as users_router
from hivora_project.runtime import Runtime
from hivora_project.web import errors

API_PREFIX = "/api/v1"
VERSION = version("hivora-project")


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
    app.include_router(auth_router, prefix=f"{API_PREFIX}/auth")
    app.include_router(users_router, prefix=f"{API_PREFIX}/users")

    @app.get(f"{API_PREFIX}/system/health")
    async def health() -> Health:
        """Public: used by the container healthcheck and the login page."""
        return Health(status="ok", version=VERSION, source_url=resolved.source_url)

    # Last: the UI answers every path the API does not.
    if resolved.frontend_dir.is_dir():
        app.mount("/", StaticFiles(directory=resolved.frontend_dir, html=True), "ui")
    return app

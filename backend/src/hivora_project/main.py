"""ASGI entrypoint: builds the FastAPI application."""

from importlib.metadata import version

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from hivora_project.core.config import Settings

API_PREFIX = "/api/v1"
VERSION = version("hivora-project")


class Health(BaseModel):
    status: str
    version: str


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(
        title="Hivora Project",
        version=VERSION,
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json",
    )

    @app.get(f"{API_PREFIX}/system/health")
    async def health() -> Health:
        """Public: used by the container healthcheck and the home page."""
        return Health(status="ok", version=VERSION)

    # Last: the UI answers every path the API does not.
    if settings.frontend_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.frontend_dir, html=True), "ui")
    return app

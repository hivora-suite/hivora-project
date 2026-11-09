"""Engine factories: SQLite (WAL, foreign keys) by default, PostgreSQL by URL."""

from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, event, make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

_PRAGMAS = (
    "PRAGMA journal_mode=WAL",
    "PRAGMA synchronous=NORMAL",
    "PRAGMA foreign_keys=ON",
    "PRAGMA busy_timeout=5000",
)


def _apply_pragmas(dbapi_conn: Any, _record: Any) -> None:
    cursor = dbapi_conn.cursor()
    for pragma in _PRAGMAS:
        cursor.execute(pragma)
    cursor.close()


def is_sqlite(url: str) -> bool:
    return make_url(url).get_backend_name() == "sqlite"


def sqlite_path(url: str) -> Path:
    return Path(str(make_url(url).database))


def _prepare(engine: Engine, url: str) -> None:
    if is_sqlite(url):
        sqlite_path(url).parent.mkdir(parents=True, exist_ok=True)
        event.listen(engine, "connect", _apply_pragmas)


def make_sync_engine(url: str) -> Engine:
    """Used by migrations, which run outside the async app."""
    engine = create_engine(url.replace("+aiosqlite", ""))
    _prepare(engine, url)
    return engine


def make_engine(url: str) -> AsyncEngine:
    engine = create_async_engine(url)
    _prepare(engine.sync_engine, url)
    return engine


def make_sessionmaker(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)

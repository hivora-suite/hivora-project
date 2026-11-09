"""Alembic environment. The database URL comes from the caller or from Settings."""

from typing import Any, Literal

from alembic import context
from alembic.autogenerate.api import AutogenContext

import hivora_project.member.models
import hivora_project.project.models
import hivora_project.task.models  # noqa: F401  (registers the tables on the metadata)
from hivora_project.core.config import Settings
from hivora_project.core.db.base import Base, UTCDateTime
from hivora_project.core.db.engine import make_sync_engine

url: str = context.config.attributes.get("url") or Settings().db_url


def render_item(type_: str, obj: Any, autogen_context: AutogenContext) -> str | Literal[False]:
    # Migrations must not import application types: UTCDateTime is a DATETIME.
    if type_ == "type" and isinstance(obj, UTCDateTime):
        return "sa.DateTime()"
    return False


engine = make_sync_engine(url)
with engine.connect() as connection:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        render_as_batch=True,  # SQLite cannot ALTER most things in place
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()
engine.dispose()

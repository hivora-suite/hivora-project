"""Programmatic Alembic entrypoint: the app upgrades its own schema on startup."""

import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text

from hivora_project.core.config import Settings
from hivora_project.core.db.engine import is_sqlite, make_sync_engine

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

SchemaState = Literal["fresh", "current", "behind", "newer"]


class SchemaTooNewError(RuntimeError):
    """The database was migrated by a newer version: this code must not touch it."""

    def __init__(self, revision: str) -> None:
        super().__init__(
            f"the database was written by a newer version of Hivora Project (schema revision "
            f"{revision}, unknown to this one): nothing was changed. Install that version "
            f"again, or restore a backup."
        )
        self.revision = revision


def alembic_config(url: str) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(MIGRATIONS_DIR))
    cfg.attributes["url"] = url
    return cfg


def upgrade_to_head(url: str) -> None:
    command.upgrade(alembic_config(url), "head")


def db_revision(url: str) -> str | None:
    """The schema revision stored in the database (None: never migrated)."""
    engine = make_sync_engine(url)
    try:
        with engine.connect() as conn:
            if not inspect(conn).has_table("alembic_version"):
                return None
            row = conn.execute(text("SELECT version_num FROM alembic_version")).first()
            return str(row[0]) if row else None
    finally:
        engine.dispose()


def schema_state(url: str) -> SchemaState:
    """Where the database stands against this code's migrations."""
    revision = db_revision(url)
    if revision is None:
        return "fresh"
    script = ScriptDirectory.from_config(alembic_config(url))
    if revision == script.get_current_head():
        return "current"
    known = {r.revision for r in script.walk_revisions()}
    return "behind" if revision in known else "newer"


def backup_sqlite(settings: Settings) -> Path:
    """A consistent copy of the database and its key, before a migration."""
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    target = settings.backups_dir / stamp
    target.mkdir(parents=True)
    engine = make_sync_engine(settings.db_url)
    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.exec_driver_sql("VACUUM INTO ?", (str(target / "hivora-project.db"),))
    finally:
        engine.dispose()
    if settings.secret_key_path.exists():
        shutil.copy2(settings.secret_key_path, target / "secret.key")
    return target


def prepare_schema(settings: Settings) -> None:
    """Refuses a newer database; backs SQLite up before migrating an existing one."""
    url = settings.db_url
    state = schema_state(url)
    if state == "newer":
        raise SchemaTooNewError(str(db_revision(url)))
    if state == "behind" and is_sqlite(url):
        backup_sqlite(settings)
    if state != "current":
        upgrade_to_head(url)

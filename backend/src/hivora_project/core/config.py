"""Settings, read from HIVORA_PROJECT_* environment variables."""

from functools import cached_property
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HIVORA_PROJECT_", frozen=True)

    data_dir: Path = Path("/opt/hivora-project/data")
    frontend_dir: Path = Path("/app/frontend")

    # "public": behind an HTTPS reverse proxy, every account needs TOTP, Secure cookies.
    access: Literal["lan", "public"] = "lan"

    # Default: SQLite in data_dir. PostgreSQL: postgresql+psycopg://…
    database_url: str | None = None
    # First start only; otherwise a one-time password is generated and shown once.
    initial_admin_password: SecretStr | None = None

    # AGPL-3.0, section 13: where the source of this version is; a modified one points to its own.
    source_url: str = "https://github.com/hivora-suite/hivora-project"

    session_idle_hours: int = 12
    session_max_days: int = 30

    @cached_property
    def db_url(self) -> str:
        return self.database_url or f"sqlite+aiosqlite:///{self.data_dir / 'hivora-project.db'}"

    @cached_property
    def secret_key_path(self) -> Path:
        return self.data_dir / "secret.key"

    @cached_property
    def backups_dir(self) -> Path:
        return self.data_dir / "backups"

"""Settings, read from HIVORA_PROJECT_* environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="HIVORA_PROJECT_")

    frontend_dir: Path = Path("/app/frontend")

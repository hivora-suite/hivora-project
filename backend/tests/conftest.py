import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import create_engine, text

from hivora_project.core.config import Settings
from hivora_project.main import create_app

ADMIN_PASSWORD = "initial-admin-password"
# The whole suite also runs on PostgreSQL in CI (D15).
POSTGRES = os.environ.get("HIVORA_PROJECT_TEST_DATABASE_URL")


def make_settings(tmp_path: Path, **overrides: object) -> Settings:
    if POSTGRES:
        engine = create_engine(POSTGRES)
        with engine.begin() as conn:
            conn.execute(text("DROP SCHEMA public CASCADE"))
            conn.execute(text("CREATE SCHEMA public"))
        engine.dispose()
    values: dict[str, object] = {
        "data_dir": tmp_path / "data",
        "frontend_dir": tmp_path / "absent",
        "database_url": POSTGRES,
        "initial_admin_password": SecretStr(ADMIN_PASSWORD),
    }
    return Settings(**{**values, **overrides})  # type: ignore[arg-type]


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return make_settings(tmp_path)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as c:
        yield c

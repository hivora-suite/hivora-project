"""Assembles the application's services."""

import asyncio
import sys
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncEngine

from hivora_project.core.config import Settings
from hivora_project.core.crypto.cipher import SecretBox, load_or_create_master_key
from hivora_project.core.db.engine import make_engine, make_sessionmaker
from hivora_project.core.db.migrate import prepare_schema
from hivora_project.member.service import AuthService
from hivora_project.project.service import ProjectService


@dataclass(frozen=True, slots=True)
class Runtime:
    settings: Settings
    engine: AsyncEngine
    auth: AuthService
    projects: ProjectService

    @classmethod
    def build(cls, settings: Settings) -> "Runtime":
        engine = make_engine(settings.db_url)
        box = SecretBox(load_or_create_master_key(settings.secret_key_path))
        sessions = make_sessionmaker(engine)
        auth = AuthService(settings=settings, sessions=sessions, box=box)
        return cls(settings, engine, auth, ProjectService(sessions=sessions, clock=auth.clock))

    async def start(self) -> None:
        await asyncio.to_thread(prepare_schema, self.settings)
        password = await self.auth.ensure_initial_admin()
        if password:
            # One time only, and it must be changed at first login.
            print(f"Initial account: admin / {password}", file=sys.stderr, flush=True)

    async def stop(self) -> None:
        await self.engine.dispose()

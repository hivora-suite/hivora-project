"""Assembles the application's services."""

import asyncio
import os
import sys
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncEngine

from hivora_project.core.config import Settings
from hivora_project.core.crypto.cipher import SecretBox, load_or_create_master_key
from hivora_project.core.db.engine import make_engine, make_sessionmaker
from hivora_project.core.db.migrate import prepare_schema
from hivora_project.member.service import AuthService
from hivora_project.planning.service import EventService
from hivora_project.project.service import ProjectService
from hivora_project.task.comments import CommentService
from hivora_project.task.service import TaskService, create_default_columns, release_assignee


@dataclass(frozen=True, slots=True)
class Runtime:
    settings: Settings
    engine: AsyncEngine
    auth: AuthService
    projects: ProjectService
    tasks: TaskService
    comments: CommentService
    events: EventService

    @classmethod
    def build(cls, settings: Settings) -> "Runtime":
        engine = make_engine(settings.db_url)
        box = SecretBox(load_or_create_master_key(settings.secret_key_path))
        sessions = make_sessionmaker(engine)
        auth = AuthService(settings=settings, sessions=sessions, box=box)
        projects = ProjectService(
            sessions=sessions,
            clock=auth.clock,
            on_created=create_default_columns,
            on_member_removed=release_assignee,
        )
        tasks = TaskService(sessions=sessions, clock=auth.clock)
        comments = CommentService(sessions=sessions, clock=auth.clock)
        events = EventService(sessions=sessions)
        return cls(settings, engine, auth, projects, tasks, comments, events)

    async def start(self) -> None:
        if self.settings.access == "public" and os.environ.get(
            "FORWARDED_ALLOW_IPS", "127.0.0.1"
        ) in ("", "127.0.0.1"):
            # Every client would share the proxy's address: one attacker locks all logins.
            print("Warning: public access without HIVORA_PROJECT_TRUSTED_PROXY; "
                  "set it to the reverse proxy's address", file=sys.stderr, flush=True)  # fmt: skip
        await asyncio.to_thread(prepare_schema, self.settings)
        password = await self.auth.ensure_initial_admin()
        if password:
            # One time only, and it must be changed at first login.
            print(f"Initial account: admin / {password}", file=sys.stderr, flush=True)

    async def stop(self) -> None:
        await self.engine.dispose()

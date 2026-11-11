"""Comments on a card."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from hivora_project.core.clock import Clock
from hivora_project.core.errors import NotFoundError, PermissionDeniedError
from hivora_project.member.access import Actor
from hivora_project.member.models import ProjectRole, User
from hivora_project.project.service import open_project
from hivora_project.task import history
from hivora_project.task.models import Comment, Task


class CommentNotFoundError(NotFoundError):
    code = "comment_not_found"


class NotCommentAuthorError(PermissionDeniedError):
    code = "not_comment_author"


@dataclass(frozen=True, slots=True)
class CommentView:
    comment: Comment
    author: str | None  # None: the account was deleted


async def _task_in_project(session: AsyncSession, project_id: int, task_id: int) -> Task:
    task = await session.get(Task, task_id)
    if task is None or task.project_id != project_id:
        raise CommentNotFoundError(str(task_id))
    return task


async def _comment(session: AsyncSession, project_id: int, comment_id: int) -> Comment:
    comment = await session.get(Comment, comment_id)
    if comment is None:
        raise CommentNotFoundError(str(comment_id))
    await _task_in_project(session, project_id, comment.task_id)
    return comment


class CommentService:
    def __init__(self, *, sessions: async_sessionmaker[AsyncSession], clock: Clock) -> None:
        self.sessions = sessions
        self.clock = clock

    async def list_comments(self, actor: Actor, project_id: int, task_id: int) -> list[CommentView]:
        async with self.sessions() as session:
            await open_project(session, actor, project_id, ProjectRole.VIEWER, writable=False)
            await _task_in_project(session, project_id, task_id)
            rows = await session.execute(
                select(Comment, User.username)
                .outerjoin(User, User.id == Comment.author_id)
                .where(Comment.task_id == task_id)
                .order_by(Comment.id.desc())
            )
            return [CommentView(comment, author) for comment, author in rows]

    async def add(self, actor: Actor, project_id: int, task_id: int, body: str) -> None:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            await _task_in_project(session, project_id, task_id)
            session.add(
                Comment(
                    task_id=task_id,
                    author_id=actor.user_id,
                    body=body,
                    created_at=self.clock.now(),
                )
            )
            # No comment text in the history: a deleted comment must leave nothing behind.
            await history.record(session, task_id, actor.user_id, "comment_added", self.clock.now())

    async def edit(self, actor: Actor, project_id: int, comment_id: int, body: str) -> None:
        async with self.sessions() as session, session.begin():
            await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            comment = await _comment(session, project_id, comment_id)
            if comment.author_id != actor.user_id:
                raise NotCommentAuthorError("only its author can edit a comment")
            comment.body, comment.edited_at = body, self.clock.now()
            await history.record(
                session, comment.task_id, actor.user_id, "comment_edited", comment.edited_at
            )

    async def delete(self, actor: Actor, project_id: int, comment_id: int) -> None:
        async with self.sessions() as session, session.begin():
            view = await open_project(session, actor, project_id, ProjectRole.CONTRIBUTOR)
            comment = await _comment(session, project_id, comment_id)
            if comment.author_id != actor.user_id and view.role is not ProjectRole.MANAGER:
                raise NotCommentAuthorError("only its author or a manager can delete a comment")
            await history.record(
                session, comment.task_id, actor.user_id, "comment_deleted", self.clock.now()
            )
            await session.delete(comment)

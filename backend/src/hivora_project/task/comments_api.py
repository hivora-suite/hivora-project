"""Comment routes (/api/v1/projects/{id}/...). Each action's role is checked by the service."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter
from pydantic import BaseModel, StringConstraints

from hivora_project.project.api import actor
from hivora_project.web.deps import Member, RuntimeDep

router = APIRouter(tags=["comments"])

Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]


class CommentOut(BaseModel):
    id: int
    author_id: int | None
    author: str | None
    body: str
    created_at: datetime
    edited: bool


class CommentIn(BaseModel):
    body: Body


@router.get("/{project_id}/tasks/{task_id}/comments")
async def list_comments(
    project_id: int, task_id: int, principal: Member, rt: RuntimeDep
) -> list[CommentOut]:
    return [
        CommentOut(
            id=v.comment.id,
            author_id=v.comment.author_id,
            author=v.author,
            body=v.comment.body,
            created_at=v.comment.created_at,
            edited=v.comment.edited_at is not None,
        )
        for v in await rt.comments.list_comments(actor(principal), project_id, task_id)
    ]


@router.post("/{project_id}/tasks/{task_id}/comments", status_code=204)
async def add_comment(
    project_id: int, task_id: int, body: CommentIn, principal: Member, rt: RuntimeDep
) -> None:
    await rt.comments.add(actor(principal), project_id, task_id, body.body)


@router.patch("/{project_id}/comments/{comment_id}", status_code=204)
async def edit_comment(
    project_id: int, comment_id: int, body: CommentIn, principal: Member, rt: RuntimeDep
) -> None:
    await rt.comments.edit(actor(principal), project_id, comment_id, body.body)


@router.delete("/{project_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    project_id: int, comment_id: int, principal: Member, rt: RuntimeDep
) -> None:
    await rt.comments.delete(actor(principal), project_id, comment_id)

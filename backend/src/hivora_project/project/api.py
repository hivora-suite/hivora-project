"""Project routes (/api/v1/projects). Each action's role is checked by the service."""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field, StringConstraints

from hivora_project.member.access import Actor
from hivora_project.member.models import ProjectRole
from hivora_project.project.service import ProjectView
from hivora_project.web.deps import Member, Principal, RuntimeDep

router = APIRouter(tags=["projects"])

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=5000)]


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    role: ProjectRole
    archived: bool
    pinned: bool = Field(description="Shown in the account's side menu")
    personal: bool = Field(description="The account's own project (My kanban), seen only by it")
    created_at: datetime


class ProjectCreateIn(BaseModel):
    name: Name
    description: Description = ""
    language: Literal["fr", "en"] = "fr"  # of the default columns


class ProjectUpdateIn(BaseModel):
    name: Name | None = None
    description: Description | None = None


class MemberOut(BaseModel):
    user_id: int
    username: str
    role: ProjectRole


class CandidateOut(BaseModel):
    id: int
    username: str


class MemberRoleIn(BaseModel):
    role: ProjectRole = Field(description="The account is added when not a member yet")


def actor(principal: Principal) -> Actor:
    return Actor(principal.user_id, principal.role)


def project_out(view: ProjectView) -> ProjectOut:
    project = view.project
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        role=view.role,
        archived=project.archived_at is not None,
        pinned=view.pinned,
        personal=project.owner_id is not None,
        created_at=project.created_at,
    )


@router.get("")
async def list_projects(
    principal: Member, rt: RuntimeDep, archived: bool = False
) -> list[ProjectOut]:
    return [
        project_out(v) for v in await rt.projects.list_projects(actor(principal), archived=archived)
    ]


@router.post("", status_code=201)
async def create_project(body: ProjectCreateIn, principal: Member, rt: RuntimeDep) -> ProjectOut:
    return project_out(
        await rt.projects.create(actor(principal), body.name, body.description, body.language)
    )


@router.get("/{project_id}")
async def get_project(project_id: int, principal: Member, rt: RuntimeDep) -> ProjectOut:
    return project_out(await rt.projects.get(actor(principal), project_id))


@router.patch("/{project_id}")
async def update_project(
    project_id: int, body: ProjectUpdateIn, principal: Member, rt: RuntimeDep
) -> ProjectOut:
    view = await rt.projects.update(
        actor(principal), project_id, name=body.name, description=body.description
    )
    return project_out(view)


@router.post("/{project_id}/archive")
async def archive_project(project_id: int, principal: Member, rt: RuntimeDep) -> ProjectOut:
    return project_out(await rt.projects.set_archived(actor(principal), project_id, archived=True))


@router.post("/{project_id}/unarchive")
async def unarchive_project(project_id: int, principal: Member, rt: RuntimeDep) -> ProjectOut:
    return project_out(await rt.projects.set_archived(actor(principal), project_id, archived=False))


@router.delete("/{project_id}", status_code=204)
async def delete_project(project_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.projects.delete(actor(principal), project_id)


@router.put("/{project_id}/pin", status_code=204)
async def pin_project(project_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.projects.set_pinned(actor(principal), project_id, pinned=True)


@router.delete("/{project_id}/pin", status_code=204)
async def unpin_project(project_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.projects.set_pinned(actor(principal), project_id, pinned=False)


@router.get("/{project_id}/members")
async def list_members(project_id: int, principal: Member, rt: RuntimeDep) -> list[MemberOut]:
    return [
        MemberOut(user_id=m.user_id, username=m.username, role=m.role)
        for m in await rt.projects.members(actor(principal), project_id)
    ]


@router.get("/{project_id}/candidates")
async def list_candidates(project_id: int, principal: Member, rt: RuntimeDep) -> list[CandidateOut]:
    return [
        CandidateOut(id=u.id, username=u.username)
        for u in await rt.projects.candidates(actor(principal), project_id)
    ]


@router.put("/{project_id}/members/{user_id}", status_code=204)
async def set_member(
    project_id: int, user_id: int, body: MemberRoleIn, principal: Member, rt: RuntimeDep
) -> None:
    await rt.projects.set_member(actor(principal), project_id, user_id, body.role)


@router.delete("/{project_id}/members/{user_id}", status_code=204)
async def remove_member(project_id: int, user_id: int, principal: Member, rt: RuntimeDep) -> None:
    await rt.projects.remove_member(actor(principal), project_id, user_id)


# /api/v1/me/project: the account's personal project, created on first use.
me_router = APIRouter(tags=["projects"])


@me_router.get("/project")
async def my_project(
    principal: Member, rt: RuntimeDep, language: Literal["fr", "en"] = "fr"
) -> ProjectOut:
    return project_out(await rt.projects.personal(actor(principal), language))

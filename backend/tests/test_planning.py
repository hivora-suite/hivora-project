import pytest
from alembic import command
from fastapi.testclient import TestClient

from hivora_project.core.config import Settings
from hivora_project.core.db import migrate
from tests.conftest import POSTGRES
from tests.test_member import error
from tests.test_projects import P, setup_project, sign_in
from tests.test_tasks import new_task

EVENT = {"title": "Atelier client", "start_date": "2030-06-10", "end_date": "2030-06-11"}


def test_events_are_created_changed_and_deleted(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    route = f"{P}/{project_id}/events"
    event = client.post(route, json=EVENT, headers=headers).json()
    assert (event["color"], event["note"]) == ("blue", "")

    changed = client.patch(
        f"{route}/{event['id']}", json={"color": "red", "title": None}, headers=headers
    ).json()
    assert (changed["color"], changed["title"]) == ("red", "Atelier client")
    backwards = client.patch(
        f"{route}/{event['id']}", json={"end_date": "2030-06-01"}, headers=headers
    )
    assert (backwards.status_code, error(backwards)) == (422, "event_dates")

    assert client.delete(f"{route}/{event['id']}", headers=headers).status_code == 204
    assert client.get(route).json() == []


def test_viewers_read_events_and_outsiders_get_a_404(client: TestClient) -> None:
    project_id, _, bob = setup_project(client)
    headers = sign_in(client, "alice")
    route = f"{P}/{project_id}/events"
    client.post(route, json=EVENT, headers=headers)
    client.put(f"{P}/{project_id}/members/{bob}", json={"role": "viewer"}, headers=headers)

    headers = sign_in(client, "bob")
    assert [e["title"] for e in client.get(route).json()] == ["Atelier client"]
    refused = client.post(route, json=EVENT, headers=headers)
    assert (refused.status_code, error(refused)) == (403, "insufficient_role")

    client.delete(f"{P}/{project_id}/members/{bob}", headers=sign_in(client, "alice"))
    sign_in(client, "bob")
    assert client.get(route).status_code == 404


def test_my_board_has_my_cards_and_my_roles(client: TestClient) -> None:
    project_id, alice, _ = setup_project(client)
    headers = sign_in(client, "alice")
    mine, _other = (new_task(client, project_id, headers, n) for n in "ab")
    client.patch(f"{P}/{project_id}/tasks/{mine}", json={"assignee_ids": [alice]}, headers=headers)

    found = client.get("/api/v1/me/board").json()
    assert [t["id"] for t in found["tasks"]] == [mine]
    assert found["projects"] == [{"id": project_id, "name": "Website", "role": "manager"}]
    client.post(f"{P}/{project_id}/archive", headers=headers)
    assert client.get("/api/v1/me/board").json()["tasks"] == []


def test_a_personal_project_is_its_owners_only(client: TestClient) -> None:
    setup_project(client)
    headers = sign_in(client, "alice")
    personal = client.get("/api/v1/me/project").json()
    assert (personal["personal"], personal["role"]) == (True, "manager")
    assert client.get("/api/v1/me/project").json()["id"] == personal["id"]
    route = f"{P}/{personal['id']}"
    columns = client.get(f"{route}/board").json()["columns"]
    assert [c["name"] for c in columns] == ["Tâches perso", "En cours", "Terminé"]
    task = new_task(client, personal["id"], headers, "Lire le contrat")
    assert task in {t["id"] for t in client.get(f"{route}/board").json()["tasks"]}
    assert personal["id"] not in {p["id"] for p in client.get(P).json()}
    for refused in (
        client.post(f"{route}/archive", headers=headers),
        client.put(f"{route}/pin", headers=headers),
        client.delete(route, headers=headers),
        client.get(f"{route}/candidates"),
    ):
        assert (refused.status_code, error(refused)) == (409, "personal_project")
    # The personal card is not in My kanban's shared projects.
    assert client.get("/api/v1/me/board").json()["tasks"] == []

    for name in ("bob", "admin"):
        sign_in(client, name)
        assert client.get(f"{route}/board").status_code == 404
        assert personal["id"] not in {p["id"] for p in client.get(P).json()}


def test_events_have_both_times_or_none(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    route = f"{P}/{project_id}/events"
    timed = {**EVENT, "end_date": EVENT["start_date"], "start_time": "09:00", "end_time": "10:30"}
    event = client.post(route, json=timed, headers=headers).json()
    assert (event["start_time"], event["end_time"]) == ("09:00", "10:30")

    for body, code in (
        ({**timed, "end_time": "09:00"}, "event_dates"),
        ({**timed, "end_time": None}, "event_times"),
        ({**timed, "end_time": "25:00"}, "request_invalid"),
    ):
        refused = client.post(route, json=body, headers=headers)
        assert (refused.status_code, error(refused)) == (422, code)

    whole_day = {"start_time": None, "end_time": None}
    cleared = client.patch(f"{route}/{event['id']}", json=whole_day, headers=headers).json()
    assert (cleared["start_time"], cleared["end_time"], cleared["title"]) == (
        None,
        None,
        "Atelier client",
    )


def test_personal_events_are_seen_only_by_their_owner(client: TestClient) -> None:
    setup_project(client)
    headers = sign_in(client, "alice")
    mine = "/api/v1/me/events"
    event = client.post(mine, json=EVENT, headers=headers).json()
    changed = client.patch(f"{mine}/{event['id']}", json={"note": "Dentiste"}, headers=headers)
    assert changed.json()["note"] == "Dentiste"
    assert [e["id"] for e in client.get(mine).json()] == [event["id"]]

    for name in ("bob", "admin"):
        headers = sign_in(client, name)
        assert client.get(mine).json() == []
        refused = client.delete(f"{mine}/{event['id']}", headers=headers)
        assert (refused.status_code, error(refused)) == (404, "event_not_found")


def test_my_kanban_orders_my_cards_and_filed_project_cards_together(client: TestClient) -> None:
    project_id, alice, bob = setup_project(client)
    headers = sign_in(client, "alice")
    shared = new_task(client, project_id, headers, "shared")
    assign = {"assignee_ids": [alice]}
    client.patch(f"{P}/{project_id}/tasks/{shared}", json=assign, headers=headers)
    personal = client.get("/api/v1/me/project").json()["id"]
    first = client.get(f"{P}/{personal}/board").json()["columns"][0]["id"]
    a, b = (new_task(client, personal, headers, n) for n in "ab")
    move = "/api/v1/me/board"

    def go(task: int, column: int | None, position: int) -> int:
        body = {"task_id": task, "column_id": column, "position": position}
        return client.post(f"{move}/move", json=body, headers=headers).status_code

    def order() -> list[int]:
        own = client.get(f"{P}/{personal}/board").json()["tasks"]
        filed = client.get(move).json()["tasks"]
        items = [(t["position"], 0, t["id"]) for t in own if t["column_id"] == first]
        items += [(t["personal_position"], 1, t["id"]) for t in filed if t["personal_column_id"]]
        return [i for _, _, i in sorted(items)]

    column_before = board_column(client, project_id, shared)
    assert go(shared, first, 1) == 204
    assert order() == [a, shared, b]
    assert go(b, first, 0) == 204
    assert order() == [b, a, shared]
    assert board_column(client, project_id, shared) == column_before
    assert go(shared, None, 0) == 204
    assert order() == [b, a]

    # My card cannot leave my columns; a project column is not mine; not my card: 404.
    for task, column, code in (
        (a, None, "column_not_found"),
        (shared, column_before, "column_not_found"),
    ):
        body = {"task_id": task, "column_id": column, "position": 0}
        refused = client.post(f"{move}/move", json=body, headers=headers)
        assert (refused.status_code, error(refused)) == (404, code)
    client.put(f"{P}/{project_id}/members/{bob}", json={"role": "contributor"}, headers=headers)
    headers = sign_in(client, "bob")
    for task in (shared, a):
        body = {"task_id": task, "column_id": None, "position": 0}
        refused = client.post(f"{move}/move", json=body, headers=headers)
        assert (refused.status_code, error(refused)) == (404, "task_not_found")


def board_column(client: TestClient, project_id: int, task: int) -> object:
    tasks = client.get(f"{P}/{project_id}/board").json()["tasks"]
    return next(t["column_id"] for t in tasks if t["id"] == task)


def test_validating_is_a_status_and_never_moves_my_kanban(client: TestClient) -> None:
    project_id, alice, bob = setup_project(client)
    headers = sign_in(client, "alice")
    # A column after "Terminé": the Done column is still "Terminé", not the last one.
    client.post(f"{P}/{project_id}/columns", json={"name": "Validation"}, headers=headers)
    columns = client.get(f"{P}/{project_id}/board").json()["columns"]
    assert [c["name"] for c in columns if c["done"]] == ["Terminé"]
    doing, project_done = columns[1]["id"], columns[2]["id"]
    task, other = (new_task(client, project_id, headers, n) for n in "ab")
    for t in (task, other):
        body = {"assignee_ids": [alice]}
        client.patch(f"{P}/{project_id}/tasks/{t}", json=body, headers=headers)
    personal = client.get("/api/v1/me/project").json()["id"]
    first, _, mine_done = (c["id"] for c in client.get(f"{P}/{personal}/board").json()["columns"])
    route = f"{P}/{project_id}/tasks/{task}"

    def go(t: int, column: int | None) -> None:
        body = {"task_id": t, "column_id": column, "position": 0}
        client.post("/api/v1/me/board/move", json=body, headers=headers)

    def mine(t: int) -> object:
        tasks = client.get("/api/v1/me/board").json()["tasks"]
        return next((x["personal_column_id"], x["done"]) for x in tasks if x["id"] == t)

    # Validated, then not: a status only, the card moves neither in its project nor in my kanban.
    client.post(f"{route}/move", json={"column_id": doing, "position": 0}, headers=headers)
    go(task, first)
    assert client.post(f"{route}/complete", headers=headers).status_code == 204
    assert (board_column(client, project_id, task), mine(task)) == (doing, (first, True))
    assert client.delete(f"{route}/complete", headers=headers).status_code == 204
    assert (board_column(client, project_id, task), mine(task)) == (doing, (first, False))
    # Each change of status is in the card's history, with who and when.
    log = client.get(f"{route}/history").json()
    assert [(e["action"], e["author"]) for e in log[:2]] == [
        ("reopened", "alice"),
        ("completed", "alice"),
    ]
    assert all(e["created_at"] for e in log[:2])
    # Put in or out of the Done column in the project: validated, then not.
    for column, done in ((project_done, True), (doing, False)):
        client.post(f"{route}/move", json={"column_id": column, "position": 0}, headers=headers)
        assert mine(task) == (first, done)
    # Filed in my Done column by me: validated, and still where it is in its project.
    go(other, mine_done)
    assert board_column(client, project_id, other) == columns[0]["id"]
    assert mine(other) == (mine_done, True)

    # A personal card only changes status.
    own = new_task(client, personal, headers, "c")
    client.post(f"{P}/{personal}/tasks/{own}/complete", headers=headers)
    card = next(t for t in client.get(f"{P}/{personal}/board").json()["tasks"] if t["id"] == own)
    assert (card["column_id"], card["done"]) == (first, True)

    # Another Done column: one per board.
    route_column = f"{P}/{project_id}/columns/{columns[3]['id']}"
    client.patch(route_column, json={"done": True}, headers=headers)
    columns = client.get(f"{P}/{project_id}/board").json()["columns"]
    assert [c["name"] for c in columns if c["done"]] == ["Validation"]

    # A viewer cannot validate.
    client.put(f"{P}/{project_id}/members/{bob}", json={"role": "viewer"}, headers=headers)
    refused = client.post(f"{route}/complete", headers=sign_in(client, "bob"))
    assert (refused.status_code, error(refused)) == (403, "insufficient_role")


@pytest.mark.skipif(POSTGRES is not None, reason="SQLite files")
def test_recent_migrations_run_on_a_filled_database(client: TestClient, settings: Settings) -> None:
    """Some SQLite schema changes copy and drop a table: refused once rows point to it."""
    project_id, alice, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    client.patch(f"{P}/{project_id}/tasks/{task}", json={"assignee_ids": [alice]}, headers=headers)
    personal = client.get("/api/v1/me/project").json()["id"]
    column = client.get(f"{P}/{personal}/board").json()["columns"][0]["id"]
    body = {"task_id": task, "column_id": column, "position": 0}
    client.post("/api/v1/me/board/move", json=body, headers=headers)
    cfg = migrate.alembic_config(settings.db_url)
    command.downgrade(cfg, "0014")
    command.upgrade(cfg, "head")

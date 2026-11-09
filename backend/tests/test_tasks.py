from fastapi.testclient import TestClient

from tests.test_member import error
from tests.test_projects import P, setup_project, sign_in


def board(client: TestClient, project_id: int) -> dict[str, list[dict[str, object]]]:
    data: dict[str, list[dict[str, object]]] = client.get(f"{P}/{project_id}/board").json()
    return data


def new_task(client: TestClient, project_id: int, headers: dict[str, str], title: str) -> int:
    task: int = client.post(
        f"{P}/{project_id}/tasks", json={"title": title}, headers=headers
    ).json()["id"]
    return task


def titles_in(client: TestClient, project_id: int, column_id: object) -> list[object]:
    return [t["title"] for t in board(client, project_id)["tasks"] if t["column_id"] == column_id]


def test_a_new_project_has_default_columns(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    assert [c["name"] for c in board(client, project_id)["columns"]] == [
        "À faire",
        "En cours",
        "Terminé",
    ]


def test_tasks_are_ordered_and_moved(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    first, second = (c["id"] for c in board(client, project_id)["columns"][:2])
    a, b, c = (new_task(client, project_id, headers, n) for n in "abc")
    assert titles_in(client, project_id, first) == ["a", "b", "c"]

    move = f"{P}/{project_id}/tasks/{c}/move"
    client.post(move, json={"column_id": first, "position": 0}, headers=headers)
    assert titles_in(client, project_id, first) == ["c", "a", "b"]
    client.post(move, json={"column_id": second, "position": 99}, headers=headers)
    assert titles_in(client, project_id, first) == ["a", "b"]
    assert titles_in(client, project_id, second) == ["c"]
    assert {a, b} < {t["id"] for t in board(client, project_id)["tasks"]}


def test_assignee_must_be_a_member_and_is_released_on_removal(client: TestClient) -> None:
    project_id, _, bob = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}"
    refused = client.patch(route, json={"assignee_id": bob}, headers=headers)
    assert refused.status_code == 422
    assert error(refused) == "assignee_not_member"

    member = f"{P}/{project_id}/members/{bob}"
    client.put(member, json={"role": "contributor"}, headers=headers)
    assert (
        client.patch(route, json={"assignee_id": bob}, headers=headers).json()["assignee_id"] == bob
    )
    client.delete(member, headers=headers)
    assert board(client, project_id)["tasks"][0]["assignee_id"] is None


def test_partial_update_keeps_the_other_fields(client: TestClient) -> None:
    project_id, alice, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}"
    client.patch(route, json={"assignee_id": alice}, headers=headers)
    body = client.patch(route, json={"title": "renamed"}, headers=headers).json()
    assert (body["title"], body["assignee_id"]) == ("renamed", alice)
    assert (
        client.patch(route, json={"assignee_id": None}, headers=headers).json()["assignee_id"]
        is None
    )


def test_roles_on_the_board(client: TestClient) -> None:
    project_id, _, bob = setup_project(client)
    headers = sign_in(client, "alice")
    column = board(client, project_id)["columns"][0]["id"]
    task = new_task(client, project_id, headers, "a")
    member = f"{P}/{project_id}/members/{bob}"

    client.put(member, json={"role": "viewer"}, headers=headers)
    viewer = sign_in(client, "bob")
    assert len(board(client, project_id)["tasks"]) == 1
    for method, path, body in (
        ("POST", f"{P}/{project_id}/tasks", {"title": "x"}),
        ("PATCH", f"{P}/{project_id}/tasks/{task}", {"title": "x"}),
        ("POST", f"{P}/{project_id}/tasks/{task}/move", {"column_id": column, "position": 0}),
    ):
        assert client.request(method, path, json=body, headers=viewer).status_code == 403

    headers = sign_in(client, "alice")
    client.put(member, json={"role": "contributor"}, headers=headers)
    contributor = sign_in(client, "bob")
    assert (
        client.post(f"{P}/{project_id}/tasks", json={"title": "y"}, headers=contributor).status_code
        == 201
    )
    for method, path in (
        ("DELETE", f"{P}/{project_id}/tasks/{task}"),
        ("DELETE", f"{P}/{project_id}/columns/{column}"),
    ):
        assert client.request(method, path, headers=contributor).status_code == 403
    response = client.post(f"{P}/{project_id}/columns", json={"name": "x"}, headers=contributor)
    assert response.status_code == 403


def test_outsiders_get_a_404(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "bob")
    assert client.get(f"{P}/{project_id}/board").status_code == 404
    response = client.post(f"{P}/{project_id}/tasks", json={"title": "x"}, headers=headers)
    assert response.status_code == 404


def test_ids_of_another_project_are_refused(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    other = client.post(P, json={"name": "other"}, headers=headers).json()["id"]
    foreign_column = board(client, other)["columns"][0]["id"]
    task = new_task(client, project_id, headers, "a")
    move = client.post(
        f"{P}/{project_id}/tasks/{task}/move",
        json={"column_id": foreign_column, "position": 0},
        headers=headers,
    )
    assert (move.status_code, error(move)) == (404, "column_not_found")
    response = client.patch(f"{P}/{other}/tasks/{task}", json={"title": "x"}, headers=headers)
    assert (response.status_code, error(response)) == (404, "task_not_found")


def test_columns_rules(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    columns = board(client, project_id)["columns"]
    task = new_task(client, project_id, headers, "a")
    used = f"{P}/{project_id}/columns/{columns[0]['id']}"
    refused = client.delete(used, headers=headers)
    assert (refused.status_code, error(refused)) == (409, "column_not_empty")

    client.patch(used, json={"name": "Backlog", "position": 2}, headers=headers)
    assert [c["name"] for c in board(client, project_id)["columns"]] == [
        "En cours",
        "Terminé",
        "Backlog",
    ]
    for column in columns[1:]:
        route = f"{P}/{project_id}/columns/{column['id']}"
        assert client.delete(route, headers=headers).status_code == 204
    assert client.delete(f"{P}/{project_id}/tasks/{task}", headers=headers).status_code == 204
    last = client.delete(used, headers=headers)
    assert (last.status_code, error(last)) == (409, "last_column")


def test_an_archived_board_is_read_only(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    client.post(f"{P}/{project_id}/archive", headers=headers)
    assert client.get(f"{P}/{project_id}/board").status_code == 200
    response = client.post(f"{P}/{project_id}/tasks", json={"title": "x"}, headers=headers)
    assert (response.status_code, error(response)) == (409, "project_archived")

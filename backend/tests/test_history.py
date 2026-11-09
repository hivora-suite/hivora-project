from typing import Any

from fastapi.testclient import TestClient

from tests.test_projects import P, setup_project, sign_in
from tests.test_tasks import board, new_task


def log(client: TestClient, project_id: int, task: int) -> list[dict[str, Any]]:
    data: list[dict[str, Any]] = client.get(f"{P}/{project_id}/tasks/{task}/history").json()
    return data


def actions(client: TestClient, project_id: int, task: int) -> list[str]:
    return [e["action"] for e in log(client, project_id, task)]


def test_a_card_records_who_changed_what(client: TestClient) -> None:
    project_id, alice, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}"
    client.patch(route, json={"title": "b"}, headers=headers)
    client.patch(route, json={"due_date": "2030-01-01", "labels": ["red"]}, headers=headers)
    client.patch(route, json={"assignee_ids": [alice]}, headers=headers)
    column = board(client, project_id)["columns"][1]
    client.post(f"{route}/move", json={"column_id": column["id"], "position": 0}, headers=headers)

    entries = log(client, project_id, task)
    assert [e["action"] for e in entries] == [
        "moved", "assignees", "labels", "dates", "title", "created",
    ]  # fmt: skip
    assert entries[0]["detail"] == column["name"]
    assert entries[4]["detail"] == "b"
    assert {e["author"] for e in entries} == {"alice"}
    assert entries[0]["created_at"]


def test_saving_the_same_values_records_nothing(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    client.patch(f"{P}/{project_id}/tasks/{task}", json={"title": "a"}, headers=headers)
    assert actions(client, project_id, task) == ["created"]


def test_repeated_autosaves_are_one_line(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}"
    for text in ("h", "he", "hel"):
        client.patch(route, json={"description": text}, headers=headers)
    assert actions(client, project_id, task) == ["description", "created"]


def test_a_merged_line_keeps_the_first_and_last_values(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}"
    client.patch(route, json={"description": "one"}, headers=headers)
    client.patch(route, json={"title": "renamed"}, headers=headers)  # in between
    client.patch(route, json={"description": "two"}, headers=headers)
    client.patch(route, json={"description": "three"}, headers=headers)
    entries = {e["action"]: e for e in log(client, project_id, task)}
    assert len(log(client, project_id, task)) == 3
    assert (entries["description"]["old_value"], entries["description"]["new_value"]) == (
        "",
        "three",
    )
    assert (entries["title"]["old_value"], entries["title"]["new_value"]) == ("a", "renamed")


def test_coming_back_to_the_start_leaves_no_line(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}"
    client.patch(route, json={"description": "typo"}, headers=headers)
    client.patch(route, json={"description": ""}, headers=headers)
    assert actions(client, project_id, task) == ["created"]


def test_lines_show_readable_values(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}"
    client.patch(route, json={"due_date": "2030-01-02"}, headers=headers)
    me = client.get("/api/v1/auth/me").json()["id"]
    client.patch(route, json={"assignee_ids": [me]}, headers=headers)
    entries = {e["action"]: e for e in log(client, project_id, task)}
    assert entries["dates"]["new_value"] == "— → 2030-01-02"
    assert entries["assignees"]["new_value"] == "alice"


def test_reordering_inside_a_column_is_not_recorded(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    column = board(client, project_id)["columns"][0]["id"]
    client.post(
        f"{P}/{project_id}/tasks/{task}/move",
        json={"column_id": column, "position": 0},
        headers=headers,
    )
    assert actions(client, project_id, task) == ["created"]


def test_checklist_and_comments_are_recorded(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}"
    client.post(f"{route}/checklist", json={"title": "x"}, headers=headers)
    item = (
        f"{P}/{project_id}/checklist/{board(client, project_id)['tasks'][0]['checklist'][0]['id']}"
    )
    client.patch(item, json={"done": True}, headers=headers)
    client.delete(item, headers=headers)
    client.post(f"{route}/comments", json={"body": "hello"}, headers=headers)
    comment = client.get(f"{route}/comments").json()[0]["id"]
    client.patch(f"{P}/{project_id}/comments/{comment}", json={"body": "hi"}, headers=headers)
    client.delete(f"{P}/{project_id}/comments/{comment}", headers=headers)
    assert actions(client, project_id, task) == [
        "comment_deleted", "comment_edited", "comment_added",
        "check_removed", "check_done", "check_added", "created",
    ]  # fmt: skip


def test_history_follows_the_access_rules(client: TestClient) -> None:
    project_id, _, bob = setup_project(client)
    headers = sign_in(client, "alice")
    task = new_task(client, project_id, headers, "a")
    route = f"{P}/{project_id}/tasks/{task}/history"
    client.put(f"{P}/{project_id}/members/{bob}", json={"role": "viewer"}, headers=headers)
    sign_in(client, "bob")
    assert client.get(route).status_code == 200
    headers = sign_in(client, "alice")
    client.delete(f"{P}/{project_id}/members/{bob}", headers=headers)
    sign_in(client, "bob")
    assert client.get(route).status_code == 404

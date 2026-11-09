from fastapi.testclient import TestClient

from tests.test_member import error
from tests.test_projects import P, setup_project, sign_in
from tests.test_tasks import new_task


def prepared(client: TestClient) -> tuple[int, int, int, dict[str, str]]:
    """A project, a card and ``bob`` as contributor; signed in as alice."""
    project_id, _, bob = setup_project(client)
    headers = sign_in(client, "alice")
    client.put(f"{P}/{project_id}/members/{bob}", json={"role": "contributor"}, headers=headers)
    return project_id, new_task(client, project_id, headers, "a"), bob, headers


def test_comments_are_listed_newest_first_with_their_author(client: TestClient) -> None:
    project_id, task, _, headers = prepared(client)
    route = f"{P}/{project_id}/tasks/{task}/comments"
    for body in (" first ", "second"):
        assert client.post(route, json={"body": body}, headers=headers).status_code == 204
    comments = client.get(route).json()
    assert [(c["body"], c["author"]) for c in comments] == [("second", "alice"), ("first", "alice")]
    assert client.post(route, json={"body": "   "}, headers=headers).status_code == 422


def test_only_the_author_edits_and_a_manager_can_delete(client: TestClient) -> None:
    project_id, task, _, headers = prepared(client)
    route = f"{P}/{project_id}/tasks/{task}/comments"
    bob = sign_in(client, "bob")
    client.post(route, json={"body": "from bob"}, headers=bob)
    comment = client.get(route).json()[0]["id"]
    item = f"{P}/{project_id}/comments/{comment}"
    assert client.patch(item, json={"body": "edited"}, headers=bob).status_code == 204
    assert client.get(route).json()[0]["edited"] is True

    headers = sign_in(client, "alice")
    refused = client.patch(item, json={"body": "not mine"}, headers=headers)
    assert (refused.status_code, error(refused)) == (403, "not_comment_author")
    client.post(route, json={"body": "from alice"}, headers=headers)
    alice_comment = client.get(route).json()[0]["id"]

    bob = sign_in(client, "bob")
    other = f"{P}/{project_id}/comments/{alice_comment}"
    refused = client.delete(other, headers=bob)
    assert (refused.status_code, error(refused)) == (403, "not_comment_author")

    headers = sign_in(client, "alice")
    assert client.delete(item, headers=headers).status_code == 204


def test_viewers_read_and_outsiders_get_a_404(client: TestClient) -> None:
    project_id, task, bob, headers = prepared(client)
    route = f"{P}/{project_id}/tasks/{task}/comments"
    client.post(route, json={"body": "hello"}, headers=headers)
    client.put(f"{P}/{project_id}/members/{bob}", json={"role": "viewer"}, headers=headers)
    viewer = sign_in(client, "bob")
    assert len(client.get(route).json()) == 1
    assert client.post(route, json={"body": "x"}, headers=viewer).status_code == 403

    headers = sign_in(client, "alice")
    client.delete(f"{P}/{project_id}/members/{bob}", headers=headers)
    outsider = sign_in(client, "bob")
    assert client.get(route).status_code == 404
    assert client.post(route, json={"body": "x"}, headers=outsider).status_code == 404


def test_comments_stay_in_their_project_and_follow_the_card(client: TestClient) -> None:
    project_id, task, _, headers = prepared(client)
    route = f"{P}/{project_id}/tasks/{task}/comments"
    client.post(route, json={"body": "hello"}, headers=headers)
    comment = client.get(route).json()[0]["id"]
    other = client.post(P, json={"name": "other"}, headers=headers).json()["id"]
    response = client.delete(f"{P}/{other}/comments/{comment}", headers=headers)
    assert (response.status_code, error(response)) == (404, "comment_not_found")
    assert client.get(f"{P}/{other}/tasks/{task}/comments").status_code == 404

    client.delete(f"{P}/{project_id}/tasks/{task}", headers=headers)
    gone = client.delete(f"{P}/{project_id}/comments/{comment}", headers=headers)
    assert gone.status_code == 404


def test_an_archived_project_keeps_its_comments_read_only(client: TestClient) -> None:
    project_id, task, _, headers = prepared(client)
    route = f"{P}/{project_id}/tasks/{task}/comments"
    client.post(route, json={"body": "hello"}, headers=headers)
    client.post(f"{P}/{project_id}/archive", headers=headers)
    assert len(client.get(route).json()) == 1
    response = client.post(route, json={"body": "x"}, headers=headers)
    assert (response.status_code, error(response)) == (409, "project_archived")

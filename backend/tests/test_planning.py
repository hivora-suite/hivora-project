from fastapi.testclient import TestClient

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


def test_my_tasks_are_the_dated_cards_assigned_to_me(client: TestClient) -> None:
    project_id, alice, _ = setup_project(client)
    headers = sign_in(client, "alice")
    mine, undated, other = (new_task(client, project_id, headers, n) for n in "abc")
    for task, body in (
        (mine, {"assignee_ids": [alice], "due_date": "2030-06-15"}),
        (undated, {"assignee_ids": [alice]}),
        (other, {"due_date": "2030-06-15"}),
    ):
        client.patch(f"{P}/{project_id}/tasks/{task}", json=body, headers=headers)

    found = client.get("/api/v1/me/tasks").json()
    assert [(t["id"], t["project_name"]) for t in found] == [(mine, "Website")]
    client.post(f"{P}/{project_id}/archive", headers=headers)
    assert client.get("/api/v1/me/tasks").json() == []


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

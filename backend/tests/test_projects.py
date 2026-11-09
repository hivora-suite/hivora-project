from fastapi.testclient import TestClient

from tests.test_member import NEW_PASSWORD, OTHER, error, login, ready_admin

P = "/api/v1/projects"


def account(client: TestClient, admin: dict[str, str], name: str) -> int:
    """Creates an account whose password is already changed; leaves the admin signed in."""
    body = {"username": name, "role": "member", "password": OTHER}
    user_id: int = client.post("/api/v1/users", json=body, headers=admin).json()["id"]
    client.cookies.clear()
    headers = login(client, name, OTHER)
    client.post(
        "/api/v1/auth/password", json={"current": OTHER, "new": NEW_PASSWORD}, headers=headers
    )
    return user_id


def sign_in(client: TestClient, name: str) -> dict[str, str]:
    client.cookies.clear()
    return login(client, name, NEW_PASSWORD)


def setup_project(client: TestClient) -> tuple[int, int, int]:
    """A project created by ``alice``, and ``bob`` outside it; returns ids, signed in as alice."""
    admin = ready_admin(client)
    alice = account(client, admin, "alice")
    admin = sign_in(client, "admin")
    bob = account(client, admin, "bob")
    headers = sign_in(client, "alice")
    project = client.post(P, json={"name": " Website "}, headers=headers).json()
    assert project["name"] == "Website"
    assert project["role"] == "manager"
    return project["id"], alice, bob


def test_a_member_only_sees_their_projects(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    assert [p["id"] for p in client.get(P).json()] == [project_id]
    sign_in(client, "bob")
    assert client.get(P).json() == []


def test_outsiders_get_a_404_on_every_route(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "bob")
    for method, path, body in (
        ("GET", f"{P}/{project_id}", None),
        ("PATCH", f"{P}/{project_id}", {"name": "x"}),
        ("POST", f"{P}/{project_id}/archive", None),
        ("GET", f"{P}/{project_id}/members", None),
        ("GET", f"{P}/{project_id}/candidates", None),
        ("PUT", f"{P}/{project_id}/members/1", {"role": "viewer"}),
        ("DELETE", f"{P}/{project_id}/members/1", None),
    ):
        response = client.request(method, path, json=body, headers=headers)
        assert response.status_code == 404, (method, path, response.text)
        assert error(response) == "project_not_found"


def test_roles_inside_a_project(client: TestClient) -> None:
    project_id, _, bob = setup_project(client)
    headers = sign_in(client, "alice")
    route = f"{P}/{project_id}/members/{bob}"
    assert client.put(route, json={"role": "viewer"}, headers=headers).status_code == 204

    bob_headers = sign_in(client, "bob")
    assert client.get(f"{P}/{project_id}").json()["role"] == "viewer"
    assert len(client.get(f"{P}/{project_id}/members").json()) == 2
    for method, path, body in (
        ("PATCH", f"{P}/{project_id}", {"name": "x"}),
        ("POST", f"{P}/{project_id}/archive", None),
        ("GET", f"{P}/{project_id}/candidates", None),
        ("DELETE", route, None),
    ):
        response = client.request(method, path, json=body, headers=bob_headers)
        assert response.status_code == 403, (method, path)
        assert error(response) == "insufficient_role"


def test_an_admin_manages_every_project(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "admin")
    assert client.get(P).json()[0]["role"] == "manager"
    response = client.patch(f"{P}/{project_id}", json={"name": "Renamed"}, headers=headers)
    assert response.json()["name"] == "Renamed"


def test_a_project_keeps_a_manager(client: TestClient) -> None:
    project_id, alice, bob = setup_project(client)
    headers = sign_in(client, "alice")
    route = f"{P}/{project_id}/members/{alice}"
    for response in (
        client.put(route, json={"role": "viewer"}, headers=headers),
        client.delete(route, headers=headers),
    ):
        assert response.status_code == 409
        assert error(response) == "last_manager"
    other = f"{P}/{project_id}/members/{bob}"
    client.put(other, json={"role": "manager"}, headers=headers)
    assert client.put(route, json={"role": "viewer"}, headers=headers).status_code == 204


def test_the_only_manager_cannot_be_deleted(client: TestClient) -> None:
    _, alice, _ = setup_project(client)
    admin = sign_in(client, "admin")
    response = client.delete(f"/api/v1/users/{alice}", headers=admin)
    assert response.status_code == 409
    assert error(response) == "last_manager"


def test_an_archived_project_is_read_only(client: TestClient) -> None:
    project_id, _, bob = setup_project(client)
    headers = sign_in(client, "alice")
    assert client.post(f"{P}/{project_id}/archive", headers=headers).json()["archived"] is True
    assert client.get(P).json() == []
    assert len(client.get(P, params={"archived": True}).json()) == 1
    assert client.get(f"{P}/{project_id}/members").status_code == 200
    for response in (
        client.patch(f"{P}/{project_id}", json={"name": "x"}, headers=headers),
        client.put(f"{P}/{project_id}/members/{bob}", json={"role": "viewer"}, headers=headers),
    ):
        assert response.status_code == 409
        assert error(response) == "project_archived"
    assert client.post(f"{P}/{project_id}/unarchive", headers=headers).json()["archived"] is False
    assert client.patch(f"{P}/{project_id}", json={"name": "x"}, headers=headers).status_code == 200


def test_candidates_are_active_accounts_outside_the_project(client: TestClient) -> None:
    project_id, _, bob = setup_project(client)
    headers = sign_in(client, "alice")
    names = {c["username"] for c in client.get(f"{P}/{project_id}/candidates").json()}
    assert names == {"admin", "bob"}
    client.put(f"{P}/{project_id}/members/{bob}", json={"role": "viewer"}, headers=headers)
    names = {c["username"] for c in client.get(f"{P}/{project_id}/candidates").json()}
    assert names == {"admin"}


def test_a_name_is_required(client: TestClient) -> None:
    project_id, _, _ = setup_project(client)
    headers = sign_in(client, "alice")
    assert client.post(P, json={"name": "   "}, headers=headers).status_code == 422
    assert client.patch(f"{P}/{project_id}", json={"name": ""}, headers=headers).status_code == 422

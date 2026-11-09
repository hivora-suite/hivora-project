import asyncio
import re
import sqlite3
from collections.abc import Iterator
from pathlib import Path

import pyotp
import pytest
from fastapi.testclient import TestClient

from hivora_project.core.config import Settings
from hivora_project.core.db import migrate
from hivora_project.core.db.engine import make_engine, make_sessionmaker
from hivora_project.core.db.migrate import SchemaTooNewError, prepare_schema
from hivora_project.main import create_app
from hivora_project.member.initial import reset_account
from tests.conftest import ADMIN_PASSWORD, POSTGRES, make_settings

NEW_PASSWORD = "a-much-better-password"
OTHER = "another-long-password"


def login(client: TestClient, username: str, password: str, **extra: object) -> dict[str, str]:
    """Logs in; returns the headers of the requests that change something."""
    response = client.post(
        "/api/v1/auth/login", json={"username": username, "password": password, **extra}
    )
    assert response.status_code == 200, response.text
    return {"X-CSRF-Token": response.json()["csrf_token"]}


def ready_admin(client: TestClient) -> dict[str, str]:
    headers = login(client, "admin", ADMIN_PASSWORD)
    response = client.post(
        "/api/v1/auth/password",
        json={"current": ADMIN_PASSWORD, "new": NEW_PASSWORD},
        headers=headers,
    )
    assert response.status_code == 204
    return headers


def code_of(response_json: dict[str, str]) -> str:
    return pyotp.TOTP(response_json["secret"]).now()


def error(response: object) -> str:
    return str(response.json()["error"]["code"])  # type: ignore[attr-defined]


def test_nothing_without_a_session(client: TestClient) -> None:
    response = client.get("/api/v1/users")
    assert response.status_code == 401
    assert error(response) == "not_authenticated"


def test_initial_password_must_be_changed_first(client: TestClient) -> None:
    headers = login(client, "admin", ADMIN_PASSWORD)
    assert client.get("/api/v1/auth/me").json()["must_change_password"] is True
    response = client.get("/api/v1/users", headers=headers)
    assert response.status_code == 403
    assert error(response) == "password_change_required"


def test_cookie_flags_follow_the_access_mode(tmp_path: Path) -> None:
    for access, secure in (("lan", False), ("public", True)):
        settings = make_settings(tmp_path / access, access=access)
        with TestClient(create_app(settings), base_url="https://testserver") as client:
            response = client.post(
                "/api/v1/auth/login", json={"username": "admin", "password": ADMIN_PASSWORD}
            )
            cookie = response.headers["set-cookie"].lower()
            assert "httponly" in cookie and "samesite=strict" in cookie
            assert ("secure" in cookie) is secure


def test_csrf_is_required_on_changes(client: TestClient) -> None:
    headers = ready_admin(client)
    body = {"username": "bob", "role": "member", "password": OTHER}
    response = client.post("/api/v1/users", json=body)
    assert response.status_code == 403
    assert error(response) == "csrf_failed"
    assert client.post("/api/v1/users", json=body, headers=headers).status_code == 201


def test_a_member_cannot_administer_accounts(client: TestClient) -> None:
    headers = ready_admin(client)
    body = {"username": "bob", "role": "member", "password": OTHER}
    assert client.post("/api/v1/users", json=body, headers=headers).status_code == 201
    client.cookies.clear()
    bob = login(client, "bob", OTHER)
    client.post("/api/v1/auth/password", json={"current": OTHER, "new": NEW_PASSWORD}, headers=bob)
    response = client.get("/api/v1/users", headers=bob)
    assert response.status_code == 403
    assert error(response) == "insufficient_role"


def test_the_last_admin_is_protected(client: TestClient) -> None:
    headers = ready_admin(client)
    admin_id = client.get("/api/v1/auth/me").json()["id"]
    response = client.patch(f"/api/v1/users/{admin_id}", json={"disabled": True}, headers=headers)
    assert response.status_code == 409
    assert error(response) == "last_admin"


def test_repeated_failures_are_slowed_down(client: TestClient) -> None:
    body = {"username": "admin", "password": "wrong-password"}
    codes = [client.post("/api/v1/auth/login", json=body).status_code for _ in range(6)]
    assert codes == [401] * 5 + [429]


def test_totp_lifecycle(client: TestClient) -> None:
    headers = ready_admin(client)
    enroll = client.post("/api/v1/auth/totp/enroll", headers=headers).json()
    confirm = client.post(
        "/api/v1/auth/totp/confirm", json={"code": code_of(enroll)}, headers=headers
    )
    assert confirm.status_code == 200
    recovery = confirm.json()["recovery_codes"]
    assert len(recovery) == 10

    client.cookies.clear()
    body = {"username": "admin", "password": NEW_PASSWORD}
    response = client.post("/api/v1/auth/login", json=body)
    assert response.status_code == 401
    assert error(response) == "totp_required"
    # The code that confirmed enrollment cannot be replayed.
    replay = client.post("/api/v1/auth/login", json={**body, "totp_code": code_of(enroll)})
    assert replay.status_code == 401
    # A recovery code works, once.
    login(client, "admin", NEW_PASSWORD, totp_code=recovery[0])
    client.cookies.clear()
    again = client.post("/api/v1/auth/login", json={**body, "totp_code": recovery[0]})
    assert again.status_code == 401


def test_admin_totp_reset_closes_the_sessions(client: TestClient) -> None:
    headers = ready_admin(client)
    body = {"username": "bob", "role": "member", "password": OTHER}
    bob_id = client.post("/api/v1/users", json=body, headers=headers).json()["id"]
    assert client.post(f"/api/v1/users/{bob_id}/totp/reset", headers=headers).status_code == 204
    client.cookies.clear()
    bob = login(client, "bob", OTHER)
    assert client.get("/api/v1/auth/me", headers=bob).status_code == 200


@pytest.fixture
def public(tmp_path: Path) -> Iterator[TestClient]:
    settings = make_settings(tmp_path, access="public")
    with TestClient(create_app(settings), base_url="https://testserver") as c:
        yield c


def test_public_instance_requires_totp(public: TestClient) -> None:
    headers = ready_admin(public)
    response = public.get("/api/v1/users", headers=headers)
    assert response.status_code == 403
    assert error(response) == "totp_setup_required"
    enroll = public.post("/api/v1/auth/totp/enroll", headers=headers).json()
    public.post("/api/v1/auth/totp/confirm", json={"code": code_of(enroll)}, headers=headers)
    assert public.get("/api/v1/users", headers=headers).status_code == 200
    refused = public.post(
        "/api/v1/auth/totp/disable", json={"password": NEW_PASSWORD}, headers=headers
    )
    assert refused.status_code == 409
    assert error(refused) == "totp_mandatory"


def test_a_generated_password_is_shown_once(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    settings = make_settings(tmp_path, initial_admin_password=None)
    with TestClient(create_app(settings)) as client:
        found = re.search(r"Initial account: admin / (\S+)", capsys.readouterr().err)
        assert found
        login(client, "admin", found[1])
    with TestClient(create_app(settings)):
        assert "Initial account" not in capsys.readouterr().err


def test_reset_account_from_the_machine(client: TestClient, settings: Settings) -> None:
    headers = ready_admin(client)
    enroll = client.post("/api/v1/auth/totp/enroll", headers=headers).json()
    client.post("/api/v1/auth/totp/confirm", json={"code": code_of(enroll)}, headers=headers)

    async def reset() -> str:
        engine = make_engine(settings.db_url)
        try:
            return await reset_account(make_sessionmaker(engine), "admin")
        finally:
            await engine.dispose()

    password = asyncio.run(reset())
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert client.post(
        "/api/v1/auth/login", json={"username": "admin", "password": password}
    ).json()["must_change_password"]


@pytest.mark.skipif(POSTGRES is not None, reason="SQLite files")
def test_a_newer_database_is_refused(settings: Settings) -> None:
    with TestClient(create_app(settings)):
        pass
    db = settings.data_dir / "hivora-project.db"
    with sqlite3.connect(db) as conn:
        conn.execute("UPDATE alembic_version SET version_num = 'from-the-future'")
    with pytest.raises(SchemaTooNewError):
        prepare_schema(settings)


@pytest.mark.skipif(POSTGRES is not None, reason="SQLite files")
def test_an_upgrade_backs_up_database_and_key(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    with TestClient(create_app(settings)):
        pass
    monkeypatch.setattr(migrate, "schema_state", lambda url: "behind")
    prepare_schema(settings)
    backups = list(settings.backups_dir.iterdir())
    assert len(backups) == 1
    assert (backups[0] / "hivora-project.db").is_file()
    assert (backups[0] / "secret.key").read_bytes() == settings.secret_key_path.read_bytes()

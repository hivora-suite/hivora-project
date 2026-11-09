from pathlib import Path

from fastapi.testclient import TestClient

from hivora_project.core.config import Settings
from hivora_project.main import VERSION, create_app
from tests.conftest import make_settings


def test_health_is_public_and_reports_the_version(client: TestClient) -> None:
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    body = response.json()
    assert (body["status"], body["version"]) == ("ok", VERSION)
    assert body["source_url"].startswith("https://")


def test_ui_is_served_without_hiding_the_api(tmp_path: Path) -> None:
    ui = tmp_path / "ui"
    ui.mkdir()
    (ui / "index.html").write_text("<h1>ui</h1>")
    settings: Settings = make_settings(tmp_path, frontend_dir=ui)
    with TestClient(create_app(settings)) as client:
        assert "ui" in client.get("/").text
        assert client.get("/api/v1/system/health").json()["status"] == "ok"

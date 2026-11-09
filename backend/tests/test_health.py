from pathlib import Path

from fastapi.testclient import TestClient

from hivora_project.core.config import Settings
from hivora_project.main import VERSION, create_app


def test_health_is_public_and_reports_the_version(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(frontend_dir=tmp_path / "absent")))
    response = client.get("/api/v1/system/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": VERSION}


def test_ui_is_served_without_hiding_the_api(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<h1>ui</h1>")
    client = TestClient(create_app(Settings(frontend_dir=tmp_path)))
    assert "ui" in client.get("/").text
    assert client.get("/api/v1/system/health").json()["status"] == "ok"

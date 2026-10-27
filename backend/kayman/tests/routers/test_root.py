import pytest
from fastapi.testclient import TestClient

from kayman.core.config import settings
from kayman.main import app

# Outside a `with` block, TestClient skips the lifespan and its DB migration.
client = TestClient(app)


def test_read_version_without_commit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "COMMIT_SHA", None)

    response = client.get("/version")

    assert response.status_code == 200
    assert response.json() == {"version": app.version, "commit": None}


def test_read_version_with_commit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "COMMIT_SHA", "abc1234")

    response = client.get("/version")

    assert response.status_code == 200
    assert response.json() == {"version": app.version, "commit": "abc1234"}

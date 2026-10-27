import pytest

from kayman.core.config import Settings


def test_empty_commit_sha_is_none(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("COMMIT_SHA", "")

    assert Settings().COMMIT_SHA is None


def test_commit_sha_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("COMMIT_SHA", "abc1234")

    assert Settings().COMMIT_SHA == "abc1234"

import pytest
from fastapi.testclient import TestClient

from app.main import DEFAULT_CORS_ORIGINS, app, cors_origins

client = TestClient(app)


def test_cors_origins_default_to_the_dev_server(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert cors_origins() == DEFAULT_CORS_ORIGINS


def test_cors_origins_come_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example.com, https://b.example.com/ ,")
    assert cors_origins() == ["https://a.example.com", "https://b.example.com"]


def test_blank_cors_origins_fall_back_to_the_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", " , ")
    assert cors_origins() == DEFAULT_CORS_ORIGINS


def test_the_dev_server_origin_is_allowed_and_others_are_not() -> None:
    allowed = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    blocked = client.get("/health", headers={"Origin": "https://evil.example.com"})
    assert "access-control-allow-origin" not in blocked.headers

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "source": "mock", "weather_source": "mock"}


def test_health_schema_names_the_fixed_keys() -> None:
    schema = client.get("/openapi.json").json()["components"]["schemas"]["Health"]
    assert set(schema["required"]) == {"status", "source", "weather_source"}


def test_cors_allows_dev_frontend() -> None:
    response = client.get("/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

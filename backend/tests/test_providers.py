import pytest
from fastapi.testclient import TestClient

from app import main
from app.models import Flight
from app.providers import MockFlightProvider, ProviderError, create_provider


def test_mock_is_the_default_source() -> None:
    assert isinstance(create_provider({}), MockFlightProvider)
    assert isinstance(create_provider({"FLIGHT_SOURCE": "mock"}), MockFlightProvider)


def test_opensky_source_needs_credentials() -> None:
    with pytest.raises(ValueError, match="OPENSKY_CLIENT_ID"):
        create_provider({"FLIGHT_SOURCE": "opensky"})


def test_opensky_source_is_created_from_env() -> None:
    env = {
        "FLIGHT_SOURCE": "opensky",
        "OPENSKY_CLIENT_ID": "a",
        "OPENSKY_CLIENT_SECRET": "b",
    }
    assert create_provider(env).name == "opensky"


def test_unknown_source_is_rejected() -> None:
    with pytest.raises(ValueError, match="FLIGHT_SOURCE"):
        create_provider({"FLIGHT_SOURCE": "nope"})


class StubProvider:
    name = "stub"

    def __init__(self, error: bool) -> None:
        self.error = error

    def get_flights(self) -> list[Flight]:
        if self.error:
            raise ProviderError("down")
        return []

    def status(self) -> dict[str, str | int | None]:
        return {"guard": "ok"}


def test_flights_endpoint_uses_the_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(main, "provider", StubProvider(error=False))
    client = TestClient(main.app)
    assert client.get("/flights").json() == []
    assert client.get("/health").json() == {"status": "ok", "source": "stub", "guard": "ok"}


def test_flights_endpoint_answers_503_when_the_provider_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(main, "provider", StubProvider(error=True))
    response = TestClient(main.app).get("/flights")
    assert response.status_code == 503

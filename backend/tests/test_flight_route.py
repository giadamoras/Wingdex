from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import main
from app.models import Airport, Flight, FlightRoute
from app.routes import LookupUnavailable

LIVE = Flight(
    id="BAW117",
    callsign="BAW117",
    latitude=52.0,
    longitude=-30.0,
    altitude_ft=36000,
    heading=270,
    speed_kt=480,
)
ROUTE = FlightRoute(
    aircraft_type="B77W",
    origin=Airport(icao="EGLL", iata="LHR", name="Heathrow", latitude=51.47, longitude=-0.46),
    duration_min=433,
    duration_estimated=True,
)


class StubProvider:
    name = "stub"

    def find_flight(self, flight_id: str) -> tuple[Flight, str | None] | None:
        return (LIVE, "abc123") if flight_id == "BAW117" else None


class StubService:
    def __init__(self, result: FlightRoute | None | Exception) -> None:
        self.result = result
        self.calls: list[tuple[str, str | None]] = []

    def lookup(self, flight: Flight, icao24: str | None) -> FlightRoute | None:
        self.calls.append((flight.id, icao24))
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def client_with(
    monkeypatch: pytest.MonkeyPatch, result: FlightRoute | None | Exception
) -> tuple[TestClient, StubService]:
    service = StubService(result)
    monkeypatch.setattr(main, "provider", StubProvider())
    monkeypatch.setattr(main, "route_service", service)
    return TestClient(main.app), service


def test_returns_the_looked_up_route(monkeypatch: pytest.MonkeyPatch) -> None:
    client, service = client_with(monkeypatch, ROUTE)
    response = client.get("/flights/BAW117/route")
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body["aircraft_type"] == "B77W" and body["duration_estimated"] is True
    assert body["origin"]["iata"] == "LHR" and body["destination"] is None
    assert service.calls == [("BAW117", "abc123")]


def test_unknown_flight_is_404(monkeypatch: pytest.MonkeyPatch) -> None:
    client, service = client_with(monkeypatch, ROUTE)
    assert client.get("/flights/NOPE/route").status_code == 404
    assert service.calls == []


def test_no_route_known_is_404(monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = client_with(monkeypatch, None)
    assert client.get("/flights/BAW117/route").status_code == 404


def test_lookup_outage_is_503(monkeypatch: pytest.MonkeyPatch) -> None:
    client, _ = client_with(monkeypatch, LookupUnavailable("down"))
    assert client.get("/flights/BAW117/route").status_code == 503


def test_a_flight_that_already_has_a_route_is_not_looked_up(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Mock mode: the feed carries the route, so the endpoint answers from it.
    from app.mock_flights import MOCK_FLIGHTS
    from app.providers import MockFlightProvider

    service = StubService(AssertionError("must not be called"))
    monkeypatch.setattr(main, "provider", MockFlightProvider())
    monkeypatch.setattr(main, "route_service", service)
    first = MOCK_FLIGHTS[0]
    response = TestClient(main.app).get(f"/flights/{first.id}/route")
    assert response.status_code == 200
    body = response.json()
    assert body["origin"]["iata"] == first.origin
    assert body["destination"]["iata"] == first.destination
    assert body["duration_estimated"] is False
    assert service.calls == []

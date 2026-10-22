from typing import Any

import httpx
from fastapi.testclient import TestClient
from helpers import StubProvider

from app.main import app, get_provider, get_route_service
from app.models import Airport, Flight, FlightRoute
from app.providers import ProviderError
from app.routes import LookupUnavailable, RouteService

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


class LoadingProvider:
    """A live feed that has not delivered its first snapshot."""

    name = "loading"
    looks_up_routes = True

    def find_flight(self, flight_id: str) -> tuple[Flight, str | None] | None:
        raise ProviderError("No flight data loaded yet")


class StubService:
    def __init__(self, result: FlightRoute | None | Exception) -> None:
        self.result = result
        self.calls: list[tuple[str, str | None]] = []

    def lookup(self, flight: Flight, icao24: str | None) -> FlightRoute | None:
        self.calls.append((flight.id, icao24))
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def client_with(result: FlightRoute | None | Exception) -> tuple[TestClient, StubService]:
    service = StubService(result)
    app.dependency_overrides[get_provider] = lambda: StubProvider(known=(LIVE, "abc123"))
    app.dependency_overrides[get_route_service] = lambda: service
    return TestClient(app), service


def test_returns_the_looked_up_route() -> None:
    client, service = client_with(ROUTE)
    response = client.get("/flights/BAW117/route")
    assert response.status_code == 200
    body: dict[str, Any] = response.json()
    assert body["aircraft_type"] == "B77W" and body["duration_estimated"] is True
    assert body["origin"]["iata"] == "LHR" and body["destination"] is None
    assert service.calls == [("BAW117", "abc123")]


def test_unknown_flight_is_404() -> None:
    client, service = client_with(ROUTE)
    assert client.get("/flights/NOPE/route").status_code == 404
    assert service.calls == []


def test_feed_not_loaded_yet_is_503_not_404() -> None:
    client, service = client_with(ROUTE)
    app.dependency_overrides[get_provider] = lambda: LoadingProvider()
    assert client.get("/flights/BAW117/route").status_code == 503
    assert service.calls == []


def test_no_route_known_is_404() -> None:
    client, _ = client_with(None)
    assert client.get("/flights/BAW117/route").status_code == 404


def test_lookup_outage_is_503() -> None:
    client, _ = client_with(LookupUnavailable("down"))
    assert client.get("/flights/BAW117/route").status_code == 503


def test_a_flight_that_already_has_a_route_is_not_looked_up() -> None:
    # Mock mode: the feed carries the route, so the endpoint answers from it.
    from app.mock_flights import MOCK_FLIGHTS
    from app.mock_providers import MockFlightProvider

    def refuse(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not ask adsbdb")

    service = RouteService(http=httpx.Client(transport=httpx.MockTransport(refuse)))
    app.dependency_overrides[get_provider] = lambda: MockFlightProvider()
    app.dependency_overrides[get_route_service] = lambda: service
    first = MOCK_FLIGHTS[0]
    response = TestClient(app).get(f"/flights/{first.id}/route")
    assert response.status_code == 200
    body = response.json()
    assert body["origin"]["iata"] == first.origin
    assert body["destination"]["iata"] == first.destination
    assert body["duration_estimated"] is False

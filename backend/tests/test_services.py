"""How the services are made and closed: on demand, once, and at startup and shutdown."""

import threading
import time

import httpx
import pytest
from fastapi.testclient import TestClient

from app import main
from app.awc import AwcWeatherProvider
from app.main import app, get_provider, get_route_service, get_weather_provider
from app.mock_providers import MockFlightProvider, MockWeatherProvider
from app.opensky import OpenSkyProvider
from app.routes import RouteService


class Spy(MockFlightProvider):
    """A mock provider that notes it was closed, and can fail when closed."""

    def __init__(self, fail: bool = False) -> None:
        self.closed = False
        self.fail = fail

    def close(self) -> None:
        self.closed = True
        if self.fail:
            raise RuntimeError("could not close")


class WeatherSpy(MockWeatherProvider):
    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


def test_nothing_is_made_on_import_and_each_service_is_made_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    made: list[str] = []

    def make_flights() -> MockFlightProvider:
        made.append("flights")
        return MockFlightProvider()

    monkeypatch.setattr(main, "create_provider", make_flights)
    assert made == []  # nothing was made by importing or by building the client
    client = TestClient(app)
    client.get("/flights")
    client.get("/flights")
    client.get("/health")
    assert made == ["flights"]


def test_the_services_are_made_at_startup_and_closed_and_forgotten_at_shutdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    flights, weather = Spy(), WeatherSpy()
    monkeypatch.setattr(main, "create_provider", lambda: flights)
    monkeypatch.setattr(main, "create_weather_provider", lambda: weather)
    with TestClient(app):
        assert get_provider.made  # made before any request
        assert get_route_service.made
        assert not flights.closed
    assert flights.closed and weather.closed
    assert not get_provider.made  # a restart makes fresh ones


def test_a_bad_setting_stops_startup_with_a_clear_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FLIGHT_SOURCE", "nope")
    with pytest.raises(ValueError, match="FLIGHT_SOURCE"):
        with TestClient(app):
            pass


def test_a_failed_startup_still_closes_what_was_already_made(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    flights = Spy()
    monkeypatch.setattr(main, "create_provider", lambda: flights)
    monkeypatch.setenv("WEATHER_SOURCE", "nope")  # the second service fails
    with pytest.raises(ValueError, match="WEATHER_SOURCE"):
        with TestClient(app):
            pass
    assert flights.closed


def test_one_service_failing_to_close_does_not_stop_the_others(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    flights, weather = Spy(fail=True), WeatherSpy()
    monkeypatch.setattr(main, "create_provider", lambda: flights)
    monkeypatch.setattr(main, "create_weather_provider", lambda: weather)
    with TestClient(app):
        pass
    assert flights.closed and weather.closed
    assert "Could not close" in caplog.text


def test_an_override_replaces_a_service_without_making_the_real_one() -> None:
    app.dependency_overrides[get_weather_provider] = lambda: WeatherSpy()
    TestClient(app).get("/weather")
    assert not get_weather_provider.made


def test_a_service_closes_the_connections_it_made_but_not_ones_handed_in() -> None:
    handed_in = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200)))
    for build in (
        lambda http: RouteService(http=http),
        lambda http: OpenSkyProvider("id", "secret", aircraft_types={}, http=http),
        lambda http: AwcWeatherProvider(http=http),
    ):
        build(handed_in).close()
        assert not handed_in.is_closed  # the caller owns it

        own = build(None)
        own.close()
        assert own._http.is_closed  # made inside, so closed inside
    handed_in.close()


def test_the_api_docs_still_build_with_the_dependencies() -> None:
    response = TestClient(app).get("/openapi.json")
    assert response.status_code == 200
    assert "/flights/{flight_id}/route" in response.json()["paths"]


def test_requests_arriving_together_make_only_one_service(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    made: list[MockFlightProvider] = []

    def slow_make() -> MockFlightProvider:
        time.sleep(0.05)  # long enough for every thread to be waiting at once
        made.append(MockFlightProvider())
        return made[-1]

    monkeypatch.setattr(main, "create_provider", slow_make)
    start = threading.Barrier(8)
    got: list[object] = []

    def ask() -> None:
        start.wait()
        got.append(get_provider())

    threads = [threading.Thread(target=ask) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(made) == 1
    assert len(got) == 8 and all(p is made[0] for p in got)

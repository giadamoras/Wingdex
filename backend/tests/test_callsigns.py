"""The flight search's backend half: which callsigns a searched flight may be flown under."""

from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from helpers import Clock, StubProvider

from app.main import app, get_provider, get_route_service
from app.routes import (
    DOWN_PAUSE_S,
    MISS_TTL_S,
    LookupUnavailable,
    RouteService,
    normalise_search,
    number_forms,
)

CHINA_EASTERN = {"name": "China Eastern Airlines", "icao": "CES", "iata": "MU"}
OTT = {"name": "OTT Airlines", "icao": "OTT", "iata": "MU"}
BA_ROUTE = {
    "flightroute": {"callsign": "BA117", "callsign_icao": "BAW117", "callsign_iata": "BA117"}
}


class FakeAdsbdb:
    """Answers adsbdb paths from a table (default: 404) and records every request."""

    def __init__(self, answers: dict[str, tuple[int, Any]] | None = None) -> None:
        self.answers = answers or {}
        self.calls: list[str] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        path = request.url.raw_path.decode().removeprefix("/v0/")
        self.calls.append(path)
        status, body = self.answers.get(path, (404, {"response": "unknown"}))
        return httpx.Response(status, json=body)


def service(fake: FakeAdsbdb, clock: Clock | None = None) -> RouteService:
    return RouteService(
        http=httpx.Client(transport=httpx.MockTransport(fake)), clock=clock or Clock()
    )


def test_a_search_is_written_like_a_callsign_or_not_asked_about() -> None:
    assert normalise_search(" mu 640 ") == "MU640"
    assert normalise_search("ba-117") == "BA117"
    assert normalise_search("MU") is None  # too short to be a flight
    assert normalise_search("CES640/../x") is None  # never anything that could bend a URL
    assert normalise_search("ABCDEFGHI") is None  # longer than a callsign


def test_adsbdb_turns_a_flight_number_into_its_callsign() -> None:
    # British Airways: adsbdb knows the flight, so its callsign comes back.
    fake = FakeAdsbdb({"callsign/BA117": (200, {"response": BA_ROUTE})})
    assert service(fake).callsigns_for("ba117") == ["BAW117"]


def test_a_flight_number_adsbdb_lacks_tries_every_airline_with_that_designator() -> None:
    # adsbdb has no route for MU640, but knows who flies as MU (two airlines).
    fake = FakeAdsbdb({"airline/MU": (200, {"response": [CHINA_EASTERN, OTT]})})
    assert service(fake).callsigns_for("MU640") == [
        "CES640",
        "CES0640",
        "OTT640",
        "OTT0640",
    ]


def test_leading_zeros_are_tried_every_way_airlines_write_them() -> None:
    # Air France broadcasts AF20 as AFR020; others drop the zeros. The feed decides.
    assert number_forms("20") == ["20", "020", "0020"]
    assert number_forms("020") == ["020", "20", "0020"]
    assert number_forms("0640") == ["0640", "640"]
    assert number_forms("12", "K") == ["12K", "012K", "0012K"]


def test_both_answers_together_without_repeats() -> None:
    fake = FakeAdsbdb(
        {
            "callsign/BA117": (200, {"response": BA_ROUTE}),
            "airline/BA": (200, {"response": [{"name": "British Airways", "icao": "BAW"}]}),
        }
    )
    assert service(fake).callsigns_for("BA117") == ["BAW117", "BAW0117"]


def test_a_callsign_is_not_read_as_a_flight_number() -> None:
    fake = FakeAdsbdb()
    assert service(fake).callsigns_for("CES640") == []
    assert fake.calls == ["callsign/CES640"]  # no airline lookup for "CE" + "S640"


def test_nothing_known_or_unusable_text_gives_no_callsigns() -> None:
    fake = FakeAdsbdb()
    assert service(fake).callsigns_for("ZZ999") == []
    assert service(fake).callsigns_for("??") == []


def test_searches_are_cached_and_misses_retried_after_an_hour() -> None:
    clock = Clock()
    fake = FakeAdsbdb()
    svc = service(fake, clock)
    svc.callsigns_for("ZZ999")
    calls = len(fake.calls)
    clock.now += MISS_TTL_S - 1
    svc.callsigns_for("zz 999")  # the same search, written differently
    assert len(fake.calls) == calls
    clock.now += 2
    svc.callsigns_for("ZZ999")
    assert len(fake.calls) == 2 * calls


def test_an_outage_raises_and_pauses_like_a_route_lookup() -> None:
    clock = Clock()
    fake = FakeAdsbdb({"callsign/BA117": (500, {})})
    svc = service(fake, clock)
    with pytest.raises(LookupUnavailable):
        svc.callsigns_for("BA117")
    calls = len(fake.calls)
    with pytest.raises(LookupUnavailable):
        svc.callsigns_for("MU640")  # another search during the pause: not even asked
    assert len(fake.calls) == calls
    clock.now += DOWN_PAUSE_S
    fake.answers = {"callsign/BA117": (200, {"response": BA_ROUTE})}
    assert svc.callsigns_for("BA117") == ["BAW117"]


class StubSearch:
    def __init__(self, result: list[str] | Exception) -> None:
        self.result = result

    def callsigns_for(self, text: str) -> list[str]:
        if isinstance(self.result, Exception):
            raise self.result
        return self.result


def client_with(result: list[str] | Exception, looks_up_routes: bool = True) -> TestClient:
    provider = StubProvider()
    provider.looks_up_routes = looks_up_routes
    app.dependency_overrides[get_provider] = lambda: provider
    app.dependency_overrides[get_route_service] = lambda: StubSearch(result)
    return TestClient(app)


def test_the_endpoint_returns_the_callsigns() -> None:
    response = client_with(["CES640", "OTT640"]).get("/callsigns/MU640")
    assert response.status_code == 200
    assert response.json() == ["CES640", "OTT640"]


def test_the_endpoint_never_asks_adsbdb_for_the_mock() -> None:
    response = client_with(LookupUnavailable("would have asked"), looks_up_routes=False).get(
        "/callsigns/MU640"
    )
    assert response.status_code == 200
    assert response.json() == []


def test_the_endpoint_says_503_while_adsbdb_is_down() -> None:
    response = client_with(LookupUnavailable("down")).get("/callsigns/MU640")
    assert response.status_code == 503

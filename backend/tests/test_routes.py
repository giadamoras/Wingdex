from typing import Any

import httpx
import pytest

from app.geo import distance_nm, interpolate
from app.mock_flights import GROUND_MIN
from app.models import Airport, Flight
from app.routes import (
    HIT_TTL_S,
    MISS_TTL_S,
    LookupUnavailable,
    RouteService,
    estimate_duration_min,
    is_plausible,
)

LHR = Airport(icao="EGLL", iata="LHR", name="London Heathrow", latitude=51.47, longitude=-0.46)
JFK = Airport(icao="KJFK", iata="JFK", name="New York JFK", latitude=40.64, longitude=-73.78)

AIRCRAFT = {
    "type": "777-336ER",
    "icao_type": "B77W",
    "manufacturer": "Boeing",
    "mode_s": "ABC123",
    "registration": "G-STBA",
    "registered_owner": "British Airways",
}


def airport_json(a: Airport, iata: str | None = None) -> dict[str, Any]:
    return {
        "icao_code": a.icao,
        "iata_code": a.iata if iata is None else iata,
        "name": a.name,
        "latitude": a.latitude,
        "longitude": a.longitude,
        "municipality": a.name.split()[0],  # "London", "New"
        "country_name": "Somewhere",
    }


AIRLINE = {"name": "British Airways", "country": "United Kingdom", "icao": "BAW"}
ROUTE = {
    "callsign": "BAW117",
    "airline": AIRLINE,
    "origin": airport_json(LHR),
    "destination": airport_json(JFK),
}


def flight_at(lat: float, lon: float, callsign: str = "BAW117") -> Flight:
    return Flight(
        id=callsign,
        callsign=callsign,
        latitude=lat,
        longitude=lon,
        altitude_ft=36000,
        heading=270,
        speed_kt=480,
    )


def mid_atlantic() -> Flight:
    lat, lon = interpolate((LHR.latitude, LHR.longitude), (JFK.latitude, JFK.longitude), 0.5)
    return flight_at(lat, lon)


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


class Clock:
    def __init__(self) -> None:
        self.now = 1_000_000.0

    def __call__(self) -> float:
        return self.now


def service(fake: FakeAdsbdb, clock: Clock | None = None) -> RouteService:
    return RouteService(
        http=httpx.Client(transport=httpx.MockTransport(fake)), clock=clock or Clock()
    )


COMBINED = "aircraft/abc123?callsign=BAW117"


def test_one_request_gives_type_route_and_estimated_duration() -> None:
    fake = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})})
    route = service(fake).lookup(mid_atlantic(), "abc123")
    assert fake.calls == [COMBINED]
    assert route is not None
    assert route.aircraft_type == "B77W"
    assert route.origin is not None and route.origin.iata == "LHR"
    assert route.destination is not None and route.destination.iata == "JFK"
    assert route.duration_min == estimate_duration_min(LHR, JFK)
    assert route.duration_estimated is True


def test_a_404_on_the_combined_call_asks_for_each_half() -> None:
    # adsbdb answers 404 if either half is unknown: here only the aircraft is known.
    fake = FakeAdsbdb({"aircraft/abc123": (200, {"response": {"aircraft": AIRCRAFT}})})
    route = service(fake).lookup(mid_atlantic(), "abc123")
    assert fake.calls == [COMBINED, "aircraft/abc123", "callsign/BAW117"]
    assert route is not None and route.aircraft_type == "B77W"
    assert route.origin is None and route.duration_min is None
    assert route.duration_estimated is False


def test_route_alone_when_the_aircraft_is_unknown() -> None:
    fake = FakeAdsbdb({"callsign/BAW117": (200, {"response": {"flightroute": ROUTE}})})
    route = service(fake).lookup(mid_atlantic(), "abc123")
    assert route is not None and route.aircraft_type is None
    assert route.destination is not None and route.destination.iata == "JFK"


def test_a_route_the_plane_is_not_on_is_dropped_but_the_type_is_kept() -> None:
    # The callsign was reused on another leg: this plane is over the Pacific.
    fake = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})})
    route = service(fake).lookup(flight_at(0.0, -150.0), "abc123")
    assert route is not None and route.aircraft_type == "B77W"
    assert route.origin is None and route.duration_min is None


def test_a_cached_route_is_checked_against_where_the_plane_is_now() -> None:
    # The same callsign flown on another leg later in the day: the answer is cached, but
    # the route must not be shown for a plane that is nowhere near it.
    fake = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})})
    svc = service(fake)
    on_route = svc.lookup(mid_atlantic(), "abc123")
    assert on_route is not None and on_route.origin is not None
    elsewhere = svc.lookup(flight_at(0.0, -150.0), "abc123")
    assert len(fake.calls) == 1  # still one request: the cache was used
    assert elsewhere is not None and elsewhere.aircraft_type == "B77W"
    assert elsewhere.origin is None and elsewhere.duration_min is None
    assert svc.lookup(mid_atlantic(), "abc123") == on_route  # and back on the route


def test_nothing_known_gives_none() -> None:
    assert service(FakeAdsbdb()).lookup(mid_atlantic(), "abc123") is None


def test_a_plane_without_a_callsign_only_asks_about_the_aircraft() -> None:
    fake = FakeAdsbdb({"aircraft/abc123": (200, {"response": {"aircraft": AIRCRAFT}})})
    route = service(fake).lookup(flight_at(50.0, -30.0, callsign="Unknown"), "abc123")
    assert fake.calls == ["aircraft/abc123"]
    assert route is not None and route.aircraft_type == "B77W"


def test_an_airport_without_an_iata_code_falls_back_to_icao() -> None:
    route_json = {**ROUTE, "origin": airport_json(LHR, iata="")}
    fake = FakeAdsbdb(
        {COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": route_json}})}
    )
    route = service(fake).lookup(mid_atlantic(), "abc123")
    assert route is not None and route.origin is not None and route.origin.iata == "EGLL"


def test_a_broken_airport_means_no_route() -> None:
    bad = {**ROUTE, "origin": {"icao_code": "EGLL"}}  # no name or position
    fake = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": bad}})})
    route = service(fake).lookup(mid_atlantic(), "abc123")
    assert route is not None and route.origin is None


def test_results_are_cached_for_a_day_and_misses_for_an_hour() -> None:
    clock = Clock()
    hit = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})})
    svc = service(hit, clock)
    svc.lookup(mid_atlantic(), "abc123")
    clock.now += HIT_TTL_S - 1
    svc.lookup(mid_atlantic(), "abc123")
    assert len(hit.calls) == 1
    clock.now += 2
    svc.lookup(mid_atlantic(), "abc123")
    assert len(hit.calls) == 2

    miss = FakeAdsbdb()
    svc = service(miss, clock)
    svc.lookup(mid_atlantic(), "abc123")
    calls = len(miss.calls)
    clock.now += MISS_TTL_S - 1
    svc.lookup(mid_atlantic(), "abc123")
    assert len(miss.calls) == calls  # still remembered as unknown
    clock.now += 2
    svc.lookup(mid_atlantic(), "abc123")
    assert len(miss.calls) == 2 * calls


def test_an_outage_raises_and_is_not_cached() -> None:
    fake = FakeAdsbdb({COMBINED: (500, {})})
    svc = service(fake)
    with pytest.raises(LookupUnavailable):
        svc.lookup(mid_atlantic(), "abc123")
    fake.answers = {COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})}
    assert svc.lookup(mid_atlantic(), "abc123") is not None  # the next tap retries


def test_garbage_from_adsbdb_counts_as_an_outage() -> None:
    def garbage(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>not json</html>")

    svc = RouteService(http=httpx.Client(transport=httpx.MockTransport(garbage)))
    with pytest.raises(LookupUnavailable):
        svc.lookup(mid_atlantic(), "abc123")


def test_duration_estimate_is_distance_at_cruise_speed_plus_ground_time() -> None:
    distance = distance_nm((LHR.latitude, LHR.longitude), (JFK.latitude, JFK.longitude))
    assert estimate_duration_min(LHR, JFK) == round(distance / 440 * 60 + GROUND_MIN)
    assert 360 < estimate_duration_min(LHR, JFK) < 480  # a transatlantic flight is 6-8 hours


def test_plausibility() -> None:
    assert is_plausible(mid_atlantic(), LHR, JFK)
    assert is_plausible(flight_at(LHR.latitude, LHR.longitude), LHR, JFK)  # just taken off
    assert is_plausible(flight_at(55.0, -30.0), LHR, JFK)  # a bit north of the great circle
    assert not is_plausible(flight_at(0.0, -150.0), LHR, JFK)  # wrong ocean
    assert not is_plausible(flight_at(10.0, 100.0), LHR, JFK)  # behind the origin
    assert not is_plausible(mid_atlantic(), LHR, LHR)  # not a route at all


def test_extra_detail_comes_from_the_aircraft_and_the_airline() -> None:
    fake = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})})
    route = service(fake).lookup(mid_atlantic(), "abc123")
    assert route is not None
    assert (route.airline, route.airline_country) == ("British Airways", "United Kingdom")
    assert (route.registration, route.manufacturer, route.model) == (
        "G-STBA",
        "Boeing",
        "777-336ER",
    )
    assert route.operator == "British Airways"
    assert route.origin is not None and route.origin.city == "London"
    assert route.origin.country == "Somewhere"


def test_detail_that_adsbdb_lacks_stays_unknown() -> None:
    aircraft = {"icao_type": "B77W", "registration": "  "}
    fake = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": aircraft, "flightroute": ROUTE}})})
    route = service(fake).lookup(mid_atlantic(), "abc123")
    assert route is not None
    assert route.registration is None and route.model is None


def test_the_airline_and_aircraft_survive_a_route_for_another_leg() -> None:
    fake = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})})
    route = service(fake).lookup(flight_at(-30.0, 100.0), "abc123")  # nowhere near the route
    assert route is not None and route.origin is None
    assert route.airline == "British Airways" and route.registration == "G-STBA"


def test_detail_alone_is_still_an_answer() -> None:
    aircraft = {"registration": "G-STBA"}  # no type code
    fake = FakeAdsbdb({"aircraft/abc123": (200, {"response": {"aircraft": aircraft}})})
    route = service(fake).lookup(mid_atlantic(), "abc123")
    assert route is not None and route.aircraft_type is None
    assert route.registration == "G-STBA"

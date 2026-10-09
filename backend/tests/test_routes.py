import threading
from typing import Any

import httpx
import pytest
from pydantic import ValidationError

from app.constants import GROUND_MIN
from app.geo import distance_nm, interpolate
from app.models import Airport, Flight
from app.routes import (
    DOWN_PAUSE_S,
    HIT_TTL_S,
    MISS_TTL_S,
    Found,
    LookupUnavailable,
    RouteService,
    estimate_duration_min,
    is_plausible,
    to_route,
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


def test_odd_feed_values_are_escaped_in_the_adsbdb_urls() -> None:
    fake = FakeAdsbdb()
    service(fake).lookup(flight_at(50.0, -30.0, callsign="A/B?c#d"), "../x")
    # Nothing from the feed can add a path segment, a query or a fragment.
    assert fake.calls == [
        "aircraft/%2E%2E%2Fx?callsign=A%2FB%3Fc%23d",
        "aircraft/%2E%2E%2Fx",
        "callsign/A%2FB%3Fc%23d",
    ]


def test_details_are_validated_not_copied_in_blindly() -> None:
    bad = Found(aircraft_type="B77W", origin=None, destination=None, details={"duration_min": "x"})
    with pytest.raises(ValidationError):
        to_route(bad, mid_atlantic())


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
    clock = Clock()
    fake = FakeAdsbdb({COMBINED: (500, {})})
    svc = service(fake, clock)
    with pytest.raises(LookupUnavailable):
        svc.lookup(mid_atlantic(), "abc123")
    fake.answers = {COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})}
    clock.now += DOWN_PAUSE_S
    assert svc.lookup(mid_atlantic(), "abc123") is not None  # the failure was not remembered


def test_taps_during_an_outage_fail_at_once_without_asking_adsbdb() -> None:
    clock = Clock()
    fake = FakeAdsbdb({COMBINED: (500, {})})
    svc = service(fake, clock)
    with pytest.raises(LookupUnavailable):
        svc.lookup(mid_atlantic(), "abc123")
    calls = len(fake.calls)
    clock.now += DOWN_PAUSE_S - 1
    with pytest.raises(LookupUnavailable):
        svc.lookup(mid_atlantic(), "abc123")
    assert len(fake.calls) == calls  # no new request during the pause
    clock.now += 1
    with pytest.raises(LookupUnavailable):
        svc.lookup(mid_atlantic(), "abc123")
    assert len(fake.calls) == 2 * calls  # the pause is over: it asked again, and failed again


def test_the_pause_counts_from_the_failure_not_from_the_start_of_the_request() -> None:
    clock = Clock()

    def slow_failure(request: httpx.Request) -> httpx.Response:
        clock.now += 8  # the request ran into the timeout
        return httpx.Response(500)

    svc = RouteService(http=httpx.Client(transport=httpx.MockTransport(slow_failure)), clock=clock)
    with pytest.raises(LookupUnavailable):
        svc.lookup(mid_atlantic(), "abc123")
    clock.now += DOWN_PAUSE_S - 1  # still inside a full pause measured from the failure
    with pytest.raises(LookupUnavailable):
        svc.lookup(mid_atlantic(), "abc123")
    assert clock.now == 1_000_000.0 + 8 + DOWN_PAUSE_S - 1  # no second request ran


def test_lookups_beyond_the_limit_give_up_without_starting_the_pause() -> None:
    inside = threading.Event()  # the first lookup has reached adsbdb
    release = threading.Event()
    calls: list[str] = []

    def slow(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        inside.set()
        release.wait(timeout=5)
        return httpx.Response(404)

    svc = RouteService(
        http=httpx.Client(transport=httpx.MockTransport(slow)),
        max_concurrent=1,
        queue_wait_s=0.05,
    )
    first = threading.Thread(target=svc.lookup, args=(mid_atlantic(), "abc123"))
    first.start()
    assert inside.wait(timeout=5)

    other = flight_at(50.0, -30.0, callsign="KLM1")
    with pytest.raises(LookupUnavailable):
        svc.lookup(other, "def456")  # no free slot
    assert len(calls) == 1  # it never reached adsbdb

    release.set()
    first.join(timeout=5)
    assert svc.lookup(other, "def456") is None  # the slot is free again, and no pause is set


def test_a_success_ends_the_pause_and_cached_answers_are_served_during_it() -> None:
    clock = Clock()
    good = {COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})}
    fake = FakeAdsbdb(good)
    svc = service(fake, clock)
    assert svc.lookup(mid_atlantic(), "abc123") is not None  # now cached

    other = flight_at(50.0, -30.0, callsign="KLM1")
    fake.answers = {"aircraft/def456?callsign=KLM1": (500, {})}
    with pytest.raises(LookupUnavailable):
        svc.lookup(other, "def456")
    assert svc.lookup(mid_atlantic(), "abc123") is not None  # cached: no request, no error

    clock.now += DOWN_PAUSE_S
    fake.answers = {"aircraft/def456?callsign=KLM1": (404, {})}
    assert svc.lookup(other, "def456") is None  # asked again and answered (unknown)
    fake.answers = {"aircraft/ghi789?callsign=KLM2": (404, {})}
    assert svc.lookup(flight_at(50.0, -30.0, callsign="KLM2"), "ghi789") is None  # no pause left


def test_a_full_cache_drops_the_entry_closest_to_expiring_instead_of_refusing() -> None:
    clock = Clock()
    fake = FakeAdsbdb()  # every plane is unknown: each answer is cached for MISS_TTL_S
    svc = RouteService(
        http=httpx.Client(transport=httpx.MockTransport(fake)), clock=clock, max_entries=2
    )
    for i, step in enumerate((0, 10, 20)):  # three planes, 10 s apart, room for two
        clock.now = 1_000_000.0 + step
        svc.lookup(flight_at(50.0, -30.0, callsign=f"AAA{i}"), f"icao{i}")
    calls = len(fake.calls)

    svc.lookup(flight_at(50.0, -30.0, callsign="AAA2"), "icao2")
    svc.lookup(flight_at(50.0, -30.0, callsign="AAA1"), "icao1")
    assert len(fake.calls) == calls  # the two newest are cached, the new plane included
    svc.lookup(flight_at(50.0, -30.0, callsign="AAA0"), "icao0")
    assert len(fake.calls) > calls  # the oldest was the one dropped


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


def test_a_route_the_feed_already_has_is_returned_without_asking_adsbdb() -> None:
    fake = FakeAdsbdb()
    feed = mid_atlantic().model_copy(
        update={"origin": LHR, "destination": JFK, "duration_min": 433, "aircraft_type": "B77W"}
    )
    route = service(fake).lookup(feed, "abc123")
    assert fake.calls == []
    assert route is not None
    assert route.origin == LHR and route.destination == JFK
    assert route.duration_min == 433 and route.aircraft_type == "B77W"
    assert route.duration_estimated is False


def test_a_feed_with_only_half_a_route_is_looked_up_as_usual() -> None:
    fake = FakeAdsbdb({COMBINED: (200, {"response": {"aircraft": AIRCRAFT, "flightroute": ROUTE}})})
    half = mid_atlantic().model_copy(update={"origin": LHR})  # no destination
    route = service(fake).lookup(half, "abc123")
    assert fake.calls == [COMBINED]
    assert route is not None and route.destination is not None

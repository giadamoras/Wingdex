from typing import Any

import httpx
import pytest

from app.geo import destination_point, distance_nm
from app.models import Flight
from app.opensky import (
    MAX_EXTRAPOLATE_S,
    NO_CALLSIGN,
    OpenSkyProvider,
    Tracked,
    advance,
    map_state,
    map_states,
    request_cost,
)
from app.providers import ProviderError

T0 = 1_000_000.0


def make_row(
    icao24: str = "abc123",
    callsign: str | None = "BAW117  ",
    lon: float | None = -0.5,
    lat: float | None = 51.0,
    baro: float | None = 10000.0,
    ground: bool = False,
    velocity: float | None = 250.0,
    track: float | None = 90.0,
    geo: float | None = 10100.0,
    time_position: float | None = T0,
    rate: float | None = 0.0,
    country: str | None = "United Kingdom",
) -> list[Any]:
    """An OpenSky state vector (18 fields)."""
    return [
        icao24, callsign, country, time_position, T0, lon, lat, baro, ground,
        velocity, track, rate, None, geo, None, False, 0, 0,
    ]  # fmt: skip


def mapped(row: list[Any]) -> Flight:
    tracked = map_state(row)
    assert tracked is not None
    return tracked.flight


# --- mapping ---


def test_map_state_converts_units_and_cleans_callsign() -> None:
    flight = mapped(make_row())
    assert flight.id == "BAW117" and flight.callsign == "BAW117"
    assert flight.altitude_ft == 32808  # 10,000 m
    assert flight.speed_kt == 486  # 250 m/s
    assert (flight.latitude, flight.longitude, flight.heading) == (51.0, -0.5, 90.0)
    # No type database was given, and OpenSky has no duration or route: all unknown.
    assert flight.aircraft_type is None and flight.duration_min is None
    assert flight.origin is None and flight.destination is None


def test_map_state_keeps_the_climb_rate_and_registration_country() -> None:
    flight = mapped(make_row(rate=10.0, country=" Ireland "))
    assert flight.vertical_rate_fpm == 1968  # 10 m/s
    assert flight.registered_country == "Ireland"
    descending = mapped(make_row(rate=-5.0))
    assert descending.vertical_rate_fpm == -984
    unknown = mapped(make_row(rate=None, country=None))
    assert unknown.vertical_rate_fpm is None and unknown.registered_country is None


def test_map_state_copes_with_a_short_row() -> None:
    flight = mapped(make_row()[:11])
    assert flight.vertical_rate_fpm is None


def test_map_state_looks_up_the_type_by_icao24() -> None:
    types = {"abc123": "B738"}
    tracked = map_state(make_row(icao24="ABC123"), types)
    assert tracked is not None and tracked.flight.aircraft_type == "B738"
    assert tracked.icao24 == "abc123"
    other = map_state(make_row(icao24="def456"), types)
    assert other is not None and other.flight.aircraft_type is None


def test_snapshot_log_counts_known_types(caplog: pytest.LogCaptureFixture) -> None:
    rows = [make_row(icao24="aaaaaa"), make_row(icao24="bbbbbb", callsign="KLM1")]
    with caplog.at_level("INFO", logger="app.opensky"):
        map_states(rows, max_flights=100, types={"aaaaaa": "A320"})
    assert "2 flights kept (cap 100), 1 with a known type" in caplog.text


def test_map_state_falls_back_to_geometric_altitude() -> None:
    assert mapped(make_row(baro=None, geo=3048.0)).altitude_ft == 10000


def test_map_state_missing_callsign_uses_icao24() -> None:
    for callsign in (None, "", "   "):
        flight = mapped(make_row(icao24="ABC123", callsign=callsign))
        assert flight.id == "abc123" and flight.callsign == NO_CALLSIGN


def test_map_state_wraps_heading() -> None:
    assert mapped(make_row(track=360.0)).heading == 0.0
    assert mapped(make_row(track=-1e-20)).heading == 0.0
    assert mapped(make_row(track=-90.0)).heading == 270.0


def test_map_state_clamps_negative_altitude() -> None:
    assert mapped(make_row(baro=-30.0)).altitude_ft == 0


@pytest.mark.parametrize(
    "row",
    [
        make_row(ground=True),
        make_row(lat=None),
        make_row(lon=None),
        make_row(baro=None, geo=None),
        make_row(velocity=None),
        make_row(velocity=0.2),  # rounds to under 1 kt
        make_row(track=None),
        make_row(lat=95.0),
        make_row(icao24=""),
        [],
    ],
)
def test_map_state_drops_unusable_rows(row: list[Any]) -> None:
    assert map_state(row) is None


def test_map_state_uses_last_contact_when_position_time_is_missing() -> None:
    tracked = map_state(make_row(time_position=None))
    assert tracked is not None and tracked.position_time == T0


def test_map_states_keeps_freshest_duplicate_callsign() -> None:
    old = make_row(icao24="aaaaaa", lat=10.0, time_position=T0 - 30)
    new = make_row(icao24="bbbbbb", lat=20.0, time_position=T0)
    (kept,) = map_states([old, new, "junk"], max_flights=100)
    assert kept.flight.latitude == 20.0


def test_map_states_cap_is_exact_and_stable() -> None:
    rows = [make_row(icao24=f"{i:06x}", callsign=None) for i in range(50)]
    first = {t.flight.id for t in map_states(rows, max_flights=10)}
    again = {t.flight.id for t in map_states(list(reversed(rows)), max_flights=10)}
    assert len(first) == 10 and first == again


# --- dead reckoning ---


def test_advance_flies_along_the_track() -> None:
    flight = mapped(make_row(lat=0.0, lon=0.0, velocity=250.0, track=90.0))
    after = advance(Tracked(flight, "abc123", T0), T0 + 120)
    moved = distance_nm((0, 0), (after.latitude, after.longitude))
    assert moved == pytest.approx(flight.speed_kt * 120 / 3600, rel=0.01)
    assert after.latitude == pytest.approx(0.0, abs=1e-6)  # due east stays on the equator


def test_advance_stops_extrapolating_after_a_while() -> None:
    flight = mapped(make_row())
    capped = advance(Tracked(flight, "abc123", T0), T0 + MAX_EXTRAPOLATE_S)
    much_later = advance(Tracked(flight, "abc123", T0), T0 + 10 * MAX_EXTRAPOLATE_S)
    assert capped == much_later


def test_destination_point_wraps_across_the_date_line() -> None:
    _, lon = destination_point((0.0, 179.9), 90.0, 60.0)  # about 1 degree east
    assert -180 <= lon < -178


# --- provider: auth, cache, failures ---


class FakeOpenSky:
    """Stands in for OpenSky's token and states endpoints, and records the calls."""

    def __init__(self, states: list[list[Any]] | None = None) -> None:
        self.states = [make_row()] if states is None else states
        self.statuses: list[int] = []  # queue of statuses for the next states calls
        self.headers: dict[str, str] = {}  # sent with non-200 answers
        self.ok_headers: dict[str, str] = {}  # sent with 200 answers
        self.token_calls = 0
        self.states_calls = 0
        self.last_states_request: httpx.Request | None = None

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.host == "auth.opensky-network.org":
            self.token_calls += 1
            return httpx.Response(
                200, json={"access_token": f"tok{self.token_calls}", "expires_in": 1800}
            )
        self.states_calls += 1
        self.last_states_request = request
        status = self.statuses.pop(0) if self.statuses else 200
        if status != 200:
            return httpx.Response(status, headers=self.headers)
        return httpx.Response(
            200, json={"time": T0, "states": self.states}, headers=self.ok_headers
        )


class Clock:
    def __init__(self) -> None:
        self.now = T0

    def __call__(self) -> float:
        return self.now


def make_provider(fake: FakeOpenSky, clock: Clock, **kwargs: Any) -> OpenSkyProvider:
    kwargs.setdefault("aircraft_types", {})  # skip loading the 500,000-entry type file
    return OpenSkyProvider(
        "id",
        "secret",
        http=httpx.Client(transport=httpx.MockTransport(fake)),
        clock=clock,
        **kwargs,
    )


def test_find_flight_returns_the_flight_and_its_icao24() -> None:
    fake, clock = FakeOpenSky(), Clock()
    provider = make_provider(fake, clock)
    assert provider.find_flight("BAW117") is None  # nothing fetched yet
    provider.get_flights()
    clock.now += 60
    found = provider.find_flight("BAW117")
    assert found is not None
    flight, icao24 = found
    assert icao24 == "abc123"
    assert flight.longitude > -0.5  # flown on, like the flights list
    assert provider.find_flight("NOPE") is None


def test_provider_returns_valid_flights_and_sends_the_token() -> None:
    fake, clock = FakeOpenSky(), Clock()
    flights = make_provider(fake, clock).get_flights()
    assert [f.id for f in flights] == ["BAW117"]
    assert fake.last_states_request is not None
    assert fake.last_states_request.headers["Authorization"] == "Bearer tok1"


def test_provider_sends_the_bounding_box() -> None:
    fake, clock = FakeOpenSky(), Clock()
    make_provider(fake, clock, bbox=(35.0, -30.0, 70.0, 45.0)).get_flights()
    assert fake.last_states_request is not None
    params = fake.last_states_request.url.params
    assert (params["lamin"], params["lomin"], params["lamax"], params["lomax"]) == (
        "35.0",
        "-30.0",
        "70.0",
        "45.0",
    )


def test_cache_serves_within_ttl_then_refreshes_with_the_same_token() -> None:
    fake, clock = FakeOpenSky(), Clock()
    provider = make_provider(fake, clock, cache_ttl_s=90)
    provider.get_flights()
    clock.now += 89
    provider.get_flights()
    assert fake.states_calls == 1
    clock.now += 2
    provider.get_flights()
    assert fake.states_calls == 2
    assert fake.token_calls == 1  # the 30 minute token is reused


def test_cached_planes_keep_moving() -> None:
    fake, clock = FakeOpenSky(), Clock()
    provider = make_provider(fake, clock)
    (before,) = provider.get_flights()
    clock.now += 30
    (after,) = provider.get_flights()
    assert fake.states_calls == 1
    assert after.longitude > before.longitude  # heading east


def test_token_is_renewed_before_it_expires() -> None:
    fake, clock = FakeOpenSky(), Clock()
    provider = make_provider(fake, clock, cache_ttl_s=90)
    provider.get_flights()
    clock.now += 1800  # past the token's life
    provider.get_flights()
    assert fake.token_calls == 2


def test_rejected_token_is_replaced_and_the_request_retried() -> None:
    fake, clock = FakeOpenSky(), Clock()
    fake.statuses = [401]
    flights = make_provider(fake, clock).get_flights()
    assert len(flights) == 1
    assert fake.token_calls == 2 and fake.states_calls == 2


def test_failure_serves_stale_data_then_backs_off() -> None:
    fake, clock = FakeOpenSky(), Clock()
    provider = make_provider(fake, clock, cache_ttl_s=90)
    provider.get_flights()
    clock.now += 100
    fake.statuses = [500]
    assert len(provider.get_flights()) == 1  # stale, not an error
    assert fake.states_calls == 2
    clock.now += 10  # still inside the 30 s backoff
    provider.get_flights()
    assert fake.states_calls == 2
    clock.now += 30
    provider.get_flights()
    assert fake.states_calls == 3


def test_failure_with_no_data_raises() -> None:
    fake, clock = FakeOpenSky(), Clock()
    fake.statuses = [500]
    provider = make_provider(fake, clock)
    with pytest.raises(ProviderError):
        provider.get_flights()
    with pytest.raises(ProviderError):  # still backing off: no second request
        provider.get_flights()
    assert fake.states_calls == 1


def test_rate_limit_waits_as_long_as_opensky_asks() -> None:
    fake, clock = FakeOpenSky(), Clock()
    provider = make_provider(fake, clock, cache_ttl_s=90)
    provider.get_flights()
    clock.now += 100
    fake.statuses = [429]
    fake.headers = {"X-Rate-Limit-Retry-After-Seconds": "3600"}
    provider.get_flights()
    clock.now += 3000
    provider.get_flights()
    assert fake.states_calls == 2  # nothing sent during the hour
    clock.now += 700
    provider.get_flights()
    assert fake.states_calls == 3


# --- credit guard ---


@pytest.mark.parametrize(
    ("bbox", "cost"),
    [
        (None, 4),
        ((0.0, 0.0, 5.0, 5.0), 1),  # 25 sq deg
        ((0.0, 0.0, 10.0, 10.0), 2),  # 100
        ((0.0, 0.0, 20.0, 20.0), 3),  # 400
        ((0.0, 0.0, 20.0, 20.1), 4),
        ((35.0, -30.0, 70.0, 45.0), 4),  # Europe and the North Atlantic
    ],
)
def test_request_cost_follows_the_area(
    bbox: tuple[float, float, float, float] | None, cost: int
) -> None:
    assert request_cost(bbox) == cost


def test_refresh_interval_cannot_go_below_the_floor() -> None:
    fake, clock = FakeOpenSky(), Clock()
    provider = make_provider(fake, clock, cache_ttl_s=5, min_ttl_s=60)
    provider.get_flights()
    clock.now += 30
    provider.get_flights()
    assert fake.states_calls == 1  # 5 s was raised to 60 s
    clock.now += 31
    provider.get_flights()
    assert fake.states_calls == 2


def test_hourly_cap_pauses_refreshing_then_resumes() -> None:
    fake, clock = FakeOpenSky(), Clock()
    provider = make_provider(fake, clock, cache_ttl_s=60, max_credits_per_hour=12)  # 3 requests
    for _ in range(3):
        provider.get_flights()
        clock.now += 60
    assert fake.states_calls == 3
    assert provider.get_flights() != []  # paused: still serves the last snapshot
    assert fake.states_calls == 3
    assert provider.status()["guard"] == "paused (hourly cap)"
    clock.now = T0 + 3601  # the first request has left the hour
    provider.get_flights()
    assert fake.states_calls == 4
    assert provider.status()["credits_spent_last_hour"] == 12  # the cap is full again
    assert provider.status()["guard"] == "paused (hourly cap)"
    clock.now = T0 + 8000  # an hour with no requests
    assert provider.status()["guard"] == "ok"


def test_retried_request_counts_twice_against_the_cap() -> None:
    fake, clock = FakeOpenSky(), Clock()
    fake.statuses = [401]
    provider = make_provider(fake, clock)
    provider.get_flights()
    assert provider.status()["credits_spent_last_hour"] == 8


def test_reserve_stops_refreshing_and_probes_until_credits_return() -> None:
    fake, clock = FakeOpenSky(), Clock()
    fake.ok_headers = {"X-Rate-Limit-Remaining": "403"}  # one more request would dip under 400
    provider = make_provider(fake, clock, cache_ttl_s=60, credit_reserve=400)
    provider.get_flights()
    assert provider.status()["credits_remaining"] == 403
    clock.now += 100
    provider.get_flights()
    assert fake.states_calls == 1  # held back by the reserve
    assert provider.status()["guard"] == "paused (reserve)"
    fake.ok_headers = {"X-Rate-Limit-Remaining": "3000"}  # the allowance came back
    clock.now += 1700  # 30 minutes since the last request: time to probe
    provider.get_flights()
    assert fake.states_calls == 2
    assert provider.status()["credits_remaining"] == 3000
    clock.now += 100
    provider.get_flights()
    assert fake.states_calls == 3  # back to normal refreshing


def test_snapshot_log_counts_what_was_dropped(caplog: pytest.LogCaptureFixture) -> None:
    rows = [make_row(), make_row(ground=True), make_row(icao24="b", lat=None)]
    with caplog.at_level("INFO", logger="app.opensky"):
        map_states(rows, max_flights=100)
    assert "3 rows, 1 on ground, 1 unusable, 0 duplicate callsigns, 1 flights kept" in caplog.text


# --- configuration ---


def test_from_env_requires_credentials() -> None:
    with pytest.raises(ValueError, match="OPENSKY_CLIENT_ID"):
        OpenSkyProvider.from_env({})


def test_from_env_reads_options() -> None:
    provider = OpenSkyProvider.from_env(
        {
            "OPENSKY_CLIENT_ID": "a",
            "OPENSKY_CLIENT_SECRET": "b",
            "OPENSKY_BBOX": "35,-30,70,45",
            "OPENSKY_CACHE_TTL_S": "120",
            "OPENSKY_MIN_TTL_S": "30",
            "OPENSKY_MAX_CREDITS_PER_HOUR": "400",
            "OPENSKY_CREDIT_RESERVE": "100",
            "OPENSKY_MAX_FLIGHTS": "500",
        }
    )
    assert provider.name == "opensky"
    assert provider.status()["credits_spent_last_hour"] == 0


def test_defaults_are_the_normal_preset() -> None:
    provider = OpenSkyProvider.from_env({"OPENSKY_CLIENT_ID": "a", "OPENSKY_CLIENT_SECRET": "b"})
    assert (provider._ttl, provider._max_per_hour, provider._reserve) == (90.0, 200, 400)


def test_default_cap_is_a_ceiling_above_the_whole_world() -> None:
    provider = OpenSkyProvider.from_env({"OPENSKY_CLIENT_ID": "a", "OPENSKY_CLIENT_SECRET": "b"})
    assert provider._max_flights == 15000

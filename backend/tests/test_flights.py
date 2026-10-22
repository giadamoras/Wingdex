import json
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.constants import GROUND_MIN
from app.geo import distance_nm, initial_bearing
from app.main import app, get_route_service
from app.mock_flights import (
    AIRLINE_AIRPORTS,
    AIRLINES,
    AIRPORTS,
    CATEGORY,
    ELEVATION_FT,
    EPOCH,
    LOCAL_HOP_NM,
    MOCK_FLIGHT_COUNT,
    MOCK_FLIGHTS,
    NO_ROUTE,
    altitude_profile,
    build_mock_flights,
    get_mock_flights,
    route_minutes,
)
from app.models import Flight
from app.routes import RouteService

client = TestClient(app)

VALID: dict[str, Any] = {
    "id": "x",
    "callsign": "TST1",
    "aircraft_type": "A320",
    "latitude": 10.0,
    "longitude": 20.0,
    "altitude_ft": 30000,
    "heading": 90.0,
    "speed_kt": 450,
    "duration_min": 60,
}


def test_flight_accepts_valid_data_without_route() -> None:
    flight = Flight(**VALID)
    assert flight.callsign == "TST1"
    assert flight.origin is None and flight.destination is None


@pytest.mark.parametrize(
    "override",
    [
        {"latitude": 91},
        {"longitude": -181},
        {"altitude_ft": -1},
        {"heading": 360},
        {"speed_kt": 0},
        {"duration_min": 0},
    ],
)
def test_flight_rejects_out_of_range_values(override: dict[str, float]) -> None:
    with pytest.raises(ValidationError):
        Flight(**{**VALID, **override})


def test_mock_routes_use_known_airports() -> None:
    for f in MOCK_FLIGHTS:
        assert f.origin in AIRPORTS and f.destination in AIRPORTS
        assert f.origin != f.destination
        assert 0 <= f.start_progress < 1


def test_mock_flights_count_and_unique_ids() -> None:
    flights = get_mock_flights(EPOCH)
    assert len(flights) == MOCK_FLIGHT_COUNT == 200
    assert len({f.id for f in flights}) == len(flights)
    assert len({f.callsign for f in flights}) == len(flights)


def test_mock_flights_are_the_same_for_the_same_seed() -> None:
    assert build_mock_flights(seed=1, count=20) == build_mock_flights(seed=1, count=20)
    assert build_mock_flights(seed=1, count=20) != build_mock_flights(seed=2, count=20)


def test_mock_flights_cover_the_whole_world() -> None:
    # (south, west, north, east) boxes; the flights must start in every one, Europe the most.
    boxes = {
        "europe": (35, -25, 71, 40),
        "north america": (15, -170, 72, -50),
        "south america": (-56, -82, 13, -34),
        "africa": (-35, -20, 37, 52),
        "asia": (-11, 60, 55, 150),
        "oceania": (-48, 110, -10, 180),
    }
    counts = dict.fromkeys(boxes, 0)
    for f in MOCK_FLIGHTS:
        origin = AIRPORTS[f.origin]
        for name, (south, west, north, east) in boxes.items():
            if south <= origin.latitude <= north and west <= origin.longitude <= east:
                counts[name] += 1
                break
    assert all(n > 0 for n in counts.values()), counts
    assert counts["europe"] == max(counts.values())


def test_mock_flights_have_altitudes_either_side_of_30000ft() -> None:
    altitudes = [f.altitude_ft for f in get_mock_flights(EPOCH)]
    assert any(a > 30000 for a in altitudes)
    assert any(a <= 30000 for a in altitudes)


def test_enough_long_haul_flights_for_the_quest() -> None:
    # The Milestone 1 quest needs flights over 6 hours.
    assert sum((f.duration_min or 0) > 360 for f in get_mock_flights(EPOCH)) >= 4


def test_mock_flights_are_complete_with_scheduled_durations() -> None:
    # Airliners and business jets fill every optional field. Light aircraft, helicopters
    # and gliders show no route or duration, like most of them in the live feed.
    for f in get_mock_flights(EPOCH):
        assert f.aircraft_type and f.vertical_rate_fpm is not None
        assert f.duration_estimated is False
        if CATEGORY[f.aircraft_type] in NO_ROUTE:
            assert f.origin is None and f.destination is None and f.duration_min is None
        else:
            assert f.duration_min and f.origin and f.destination


def test_a_mock_flight_without_a_route_is_not_looked_up() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not send a made-up callsign to adsbdb")

    service = RouteService(http=httpx.Client(transport=httpx.MockTransport(refuse)))
    app.dependency_overrides[get_route_service] = lambda: service
    local = next(f for f in MOCK_FLIGHTS if CATEGORY[f.aircraft_type] in NO_ROUTE)
    response = client.get(f"/flights/{local.id}/route")
    assert response.status_code == 404


def test_duration_matches_distance_and_speed() -> None:
    for flight in get_mock_flights(EPOCH):
        if flight.origin is None or flight.destination is None:
            continue  # a local flyer, which shows no route
        distance = distance_nm(
            (flight.origin.latitude, flight.origin.longitude),
            (flight.destination.latitude, flight.destination.longitude),
        )
        assert flight.duration_min == round(distance / flight.speed_kt * 60 + GROUND_MIN)


def test_flights_move_at_real_speed() -> None:
    before = get_mock_flights(EPOCH)
    after = get_mock_flights(EPOCH + 60)  # one minute later
    for b, a in zip(before, after, strict=True):
        moved = distance_nm((b.latitude, b.longitude), (a.latitude, a.longitude))
        assert moved == pytest.approx(b.speed_kt / 60, rel=0.01)


def test_heading_points_at_destination() -> None:
    for mock, flight in zip(MOCK_FLIGHTS, get_mock_flights(EPOCH + 300), strict=True):
        destination = AIRPORTS[mock.destination]  # also for a flight that shows no route
        dest = (destination.latitude, destination.longitude)
        assert flight.heading == pytest.approx(
            initial_bearing((flight.latitude, flight.longitude), dest)
        )


def test_flights_loop_after_arriving() -> None:
    start = get_mock_flights(EPOCH)
    for mock, first in zip(MOCK_FLIGHTS, start, strict=True):
        # One full trip later the flight is back where it was.
        (again,) = [
            f for f in get_mock_flights(EPOCH + route_minutes(mock) * 60) if f.id == mock.id
        ]
        assert (again.latitude, again.longitude) == pytest.approx(
            (first.latitude, first.longitude), abs=1e-6
        )


def test_get_flights_endpoint() -> None:
    response = client.get("/flights")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == len(MOCK_FLIGHTS)
    assert set(body[0]) == set(Flight.model_fields)
    flight = Flight.model_validate(body[0])
    assert flight.origin is not None and flight.origin.iata


def test_flight_list_is_gzipped_when_the_browser_accepts_it() -> None:
    response = client.get("/flights", headers={"Accept-Encoding": "gzip"})
    assert response.headers["content-encoding"] == "gzip"
    assert response.json()  # the client decodes it transparently


# --- The mock against the frontend's catalogs, and how its planes fly -------------------

CONTENT = Path(__file__).parents[2] / "frontend" / "src" / "content"
AIRLINE_CODES = {a.prefix for a in AIRLINES}


def _catalog(name: str) -> Any:
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


def test_every_catalog_airline_flies_in_the_mock() -> None:
    # The airline and airline-kind quests and the Dex need every airline to be catchable.
    catalog = _catalog("airlines.json")
    assert AIRLINE_CODES == set(catalog)
    flown = {f.callsign[:3] for f in MOCK_FLIGHTS if f.callsign[:3] in AIRLINE_CODES}
    assert flown == set(catalog)


def test_mock_types_are_in_the_type_catalog_with_the_same_category() -> None:
    types = _catalog("aircraft-types.json")["types"]
    for kind, category in CATEGORY.items():
        assert types[kind]["category"] == category, kind


def test_every_category_flies_in_the_mock() -> None:
    flown = {CATEGORY[f.aircraft_type] for f in MOCK_FLIGHTS}
    assert flown == {
        "narrowBody", "wideBody", "regionalJet", "turboprop",
        "bizJet", "light", "helicopter", "glider",
    }  # fmt: skip
    assert len({f.aircraft_type for f in MOCK_FLIGHTS}) >= 40


def test_some_planes_climb_and_some_descend_steeply_enough_for_the_quests() -> None:
    # The climbing and descending quests need over 1,000 fpm (quest.ts).
    rates = [f.vertical_rate_fpm or 0 for f in get_mock_flights(EPOCH)]
    assert sum(r > 1000 for r in rates) >= 5
    assert sum(r < -1000 for r in rates) >= 5
    assert sum(r == 0 for r in rates) > len(rates) / 2  # most are cruising


def test_a_flight_climbs_out_cruises_and_descends_in() -> None:
    long_haul = next(f for f in MOCK_FLIGHTS if route_minutes(f) > 360)
    total = route_minutes(long_haul)
    origin = ELEVATION_FT.get(long_haul.origin, 0)
    dest = ELEVATION_FT.get(long_haul.destination, 0)
    assert altitude_profile(long_haul, 0, total) == (origin, long_haul.climb_fpm)
    assert altitude_profile(long_haul, 1, total) == (
        origin + long_haul.climb_fpm,
        long_haul.climb_fpm,
    )
    assert altitude_profile(long_haul, total, total) == (dest, -long_haul.descent_fpm)
    peak = max(altitude_profile(long_haul, t * total / 100, total)[0] for t in range(101))
    assert peak <= long_haul.cruise_ft


def test_no_plane_flies_below_its_airfields() -> None:
    for flight in MOCK_FLIGHTS:
        total = route_minutes(flight)
        lowest = min(ELEVATION_FT.get(flight.origin, 0), ELEVATION_FT.get(flight.destination, 0))
        for step in range(101):
            altitude, _ = altitude_profile(flight, step * total / 100, total)
            assert altitude >= lowest, flight.id
        assert flight.cruise_ft > max(
            ELEVATION_FT.get(flight.origin, 0), ELEVATION_FT.get(flight.destination, 0)
        )


def test_light_aircraft_helicopters_and_gliders_make_low_slow_local_hops() -> None:
    for flight in MOCK_FLIGHTS:
        if CATEGORY[flight.aircraft_type] in {"light", "helicopter", "glider"}:
            low, high = LOCAL_HOP_NM
            assert low <= _route_nm(flight.origin, flight.destination) <= high
            assert flight.cruise_ft <= 13000 and flight.speed_kt <= 150
            # A registration, not an airline callsign, so no airline quest matches it.
            assert flight.callsign[:3] not in AIRLINE_CODES


def test_airlines_fly_only_between_airline_airports_and_low_cost_stays_short() -> None:
    no_long_haul = {a.prefix for a in AIRLINES if a.long == ()}
    for flight in MOCK_FLIGHTS:
        prefix = flight.callsign[:3]
        if prefix in AIRLINE_CODES and flight.callsign[3:].isdigit():
            assert flight.origin in AIRLINE_AIRPORTS and flight.destination in AIRLINE_AIRPORTS
            if prefix in no_long_haul:
                assert _route_nm(flight.origin, flight.destination) <= 2400


def test_every_flight_has_a_registered_country_and_airports_a_city_and_country() -> None:
    assert all(f.registered_country for f in get_mock_flights(EPOCH))
    assert all(a.city and a.country for a in AIRPORTS.values())
    assert len({a.icao for a in AIRPORTS.values()}) == len(AIRPORTS)


def _route_nm(a: str, b: str) -> float:
    pa, pb = AIRPORTS[a], AIRPORTS[b]
    return distance_nm((pa.latitude, pa.longitude), (pb.latitude, pb.longitude))


def test_every_mock_airport_gets_a_passport_stamp() -> None:
    # The Dex stamps a destination's country from its ICAO prefix (shared-lib/countries.ts).
    prefixes = _catalog("icao-prefixes.json")
    for airport in AIRPORTS.values():
        assert any(airport.icao.startswith(p) for p in prefixes), airport.icao

from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.constants import GROUND_MIN
from app.geo import distance_nm, initial_bearing
from app.main import app
from app.mock_flights import (
    AIRPORTS,
    EPOCH,
    MOCK_FLIGHTS,
    build_mock_flights,
    get_mock_flights,
    route_minutes,
)
from app.models import Flight

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
    assert len(flights) == 100
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
    for f in get_mock_flights(EPOCH):
        assert f.origin is not None
        for name, (south, west, north, east) in boxes.items():
            if south <= f.origin.latitude <= north and west <= f.origin.longitude <= east:
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
    # The mock keeps every optional field filled, so mock mode behaves as before.
    for f in get_mock_flights(EPOCH):
        assert f.aircraft_type and f.duration_min and f.origin and f.destination
        assert f.duration_estimated is False


def test_duration_matches_distance_and_speed() -> None:
    for flight in get_mock_flights(EPOCH):
        assert flight.origin is not None and flight.destination is not None
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
    for flight in get_mock_flights(EPOCH + 300):
        assert flight.destination is not None
        dest = (flight.destination.latitude, flight.destination.longitude)
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

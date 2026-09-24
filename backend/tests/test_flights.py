import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.mock_flights import BASE_FLIGHTS, JITTER_DEG, get_mock_flights
from app.models import Flight

client = TestClient(app)

VALID = {
    "id": "x",
    "callsign": "TST1",
    "aircraft_type": "A320",
    "latitude": 10.0,
    "longitude": 20.0,
    "altitude_ft": 30000,
    "heading": 90.0,
    "duration_min": 60,
}


def test_flight_accepts_valid_data() -> None:
    assert Flight(**VALID).callsign == "TST1"  # type: ignore[arg-type]


@pytest.mark.parametrize(
    "override",
    [
        {"latitude": 91},
        {"longitude": -181},
        {"altitude_ft": -1},
        {"heading": 360},
        {"duration_min": 0},
    ],
)
def test_flight_rejects_out_of_range_values(override: dict[str, float]) -> None:
    with pytest.raises(ValidationError):
        Flight(**{**VALID, **override})  # type: ignore[arg-type]


def test_mock_flights_count_and_unique_ids() -> None:
    flights = get_mock_flights()
    assert 8 <= len(flights) <= 10
    assert len({f.id for f in flights}) == len(flights)


def test_mock_flights_have_altitudes_either_side_of_30000ft() -> None:
    altitudes = [f.altitude_ft for f in get_mock_flights()]
    assert any(a > 30000 for a in altitudes)
    assert any(a <= 30000 for a in altitudes)


def test_mock_positions_are_jittered_within_bounds() -> None:
    for base, flight in zip(BASE_FLIGHTS, get_mock_flights(), strict=True):
        assert flight.id == base.id
        assert abs(flight.latitude - base.latitude) <= JITTER_DEG
        assert abs(flight.longitude - base.longitude) <= JITTER_DEG


def test_mock_positions_change_between_calls() -> None:
    first = [(f.latitude, f.longitude) for f in get_mock_flights()]
    second = [(f.latitude, f.longitude) for f in get_mock_flights()]
    assert first != second


def test_get_flights_endpoint() -> None:
    response = client.get("/flights")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == len(BASE_FLIGHTS)
    assert set(body[0]) == set(Flight.model_fields)
    Flight.model_validate(body[0])

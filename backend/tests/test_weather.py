from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.mock_weather import MOCK_AREAS, VALID_AFTER_S, VALID_BEFORE_S, get_mock_weather
from app.models import WeatherArea

client = TestClient(app)

NOW = 1_800_000_000

POLYGON = [
    {"latitude": 0, "longitude": 0},
    {"latitude": 0, "longitude": 1},
    {"latitude": 1, "longitude": 1},
    {"latitude": 0, "longitude": 0},
]

VALID: dict[str, Any] = {
    "id": "x",
    "hazard": "turbulence",
    "region": "Test",
    "altitude_min_ft": 10000,
    "altitude_max_ft": 30000,
    "valid_from": NOW,
    "valid_to": NOW + 3600,
    "polygon": POLYGON,
}


def test_weather_area_accepts_valid_data_without_movement() -> None:
    area = WeatherArea(**VALID)
    assert area.hazard == "turbulence"
    assert area.movement_dir is None and area.movement_speed_kt is None


@pytest.mark.parametrize(
    "override",
    [
        {"hazard": "fog"},
        {"altitude_min_ft": -1},
        {"altitude_max_ft": 0},
        {"polygon": POLYGON[:3]},  # too few points to be a ring
        {"movement_dir": 360},
    ],
)
def test_weather_area_rejects_invalid_values(override: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        WeatherArea(**{**VALID, **override})


def test_mock_weather_has_unique_ids_and_every_hazard() -> None:
    areas = get_mock_weather(NOW)
    assert len({a.id for a in areas}) == len(areas)
    assert {a.hazard for a in areas} == {
        "thunderstorm",
        "turbulence",
        "icing",
        "volcanic_ash",
        "tropical_cyclone",
        "mountain_wave",
    }


def test_mock_polygons_are_closed_rings() -> None:
    for area in get_mock_weather(NOW):
        assert area.polygon[0] == area.polygon[-1]
        assert len(area.polygon) == 5


def test_mock_altitude_bounds_are_ordered() -> None:
    for a in MOCK_AREAS:
        assert a.altitude_min_ft < a.altitude_max_ft


def test_mock_areas_are_valid_around_now() -> None:
    for area in get_mock_weather(NOW):
        assert area.valid_from == NOW - VALID_BEFORE_S
        assert area.valid_to == NOW + VALID_AFTER_S


def test_get_weather_endpoint() -> None:
    response = client.get("/weather")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == len(MOCK_AREAS)
    assert set(body[0]) == set(WeatherArea.model_fields)
    WeatherArea.model_validate(body[0])
